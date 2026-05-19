"""
Inspection and property document routes:
  pending inspections, inspection-reports, inspected collection,
  custodian-slips, inventory-transfer-reports, property-transfer-reports,
  property-return-slips, waste-materials-reports
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
from datetime import datetime, timezone
from typing import List
import traceback

from database import get_database
from auth import decode_access_token
from models import (
    CreateInspectionReport, InspectionReportResponse,
    CreateCustodianSlip, CustodianSlipResponse,
    CreatePropertyReturnSlip, PropertyReturnSlipResponse,
    CreateWasteMaterialsReport, WasteMaterialsReportResponse,
)
from api.blockchain_client import get_blockchain_client
from routers.deps import security

router = APIRouter(tags=["inspections"])


def _require_token(credentials: HTTPAuthorizationCredentials) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token")
    return payload


# ---------------------------------------------------------------------------
# Pending Inspections
# ---------------------------------------------------------------------------

@router.get("/api/inspections")
async def get_inspections(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Fetch all pending inspections."""
    try:
        _require_token(credentials)
        db = await get_database()
        cursor = db.pending_inspections.find({}).sort("date_created", -1)
        inspections = await cursor.to_list(length=None)
        result = []
        for doc in inspections:
            doc["id"] = str(doc.get("_id", ""))
            doc.pop("_id", None)
            result.append(doc)
        return JSONResponse(content=result, status_code=status.HTTP_200_OK)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching pending inspections: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            content={"detail": f"An error occurred: {e}"})


@router.get("/api/inspections/check/{po_number}")
async def check_inspection_status(
    po_number: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Check if a purchase order exists in pending_inspections."""
    try:
        _require_token(credentials)
        db = await get_database()
        inspection = await db.pending_inspections.find_one({"po_number": po_number})
        return {
            "exists": inspection is not None,
            "status": inspection.get("status") if inspection else None,
            "confirmed_at": inspection.get("confirmed_at") if inspection else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.get("/api/inspections/{po_number}")
async def get_inspection(
    po_number: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        _require_token(credentials)
        db = await get_database()
        inspection = await db.pending_inspections.find_one({"po_number": po_number})
        if not inspection:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection not found")
        inspection["id"] = str(inspection["_id"])
        return inspection
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


# ---------------------------------------------------------------------------
# Inspection Reports
# ---------------------------------------------------------------------------

@router.post("/api/inspection-reports", response_model=InspectionReportResponse)
async def create_inspection_report(
    report: CreateInspectionReport,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        _require_token(credentials)
        db = await get_database()

        counter = await db.counters.find_one_and_update(
            {"_id": "inspection_report_id"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        report_id_seq = str(counter.get("seq", 1)) if counter else "1"

        report_doc = {
            "po_number": report.po_number,
            "inspection_date": report.inspection_date,
            "inspected_by": report.inspected_by,
            "items": [item.dict() for item in report.items],
            "overall_remarks": report.overall_remarks or "",
            "status": report.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None,
        }

        result = await db.inspection_reports.insert_one(report_doc)
        inspection_report_id = str(result.inserted_id)
        report_doc["id"] = inspection_report_id

        try:
            blockchain_client = get_blockchain_client()
            bc_result = blockchain_client.record_inspection(
                inspection_id=inspection_report_id,
                po_number=report.po_number,
                inspection_date=report.inspection_date,
                inspected_by=report.inspected_by,
                status=report.status,
                items=[item.dict() for item in report.items],
                overall_remarks=report.overall_remarks or "",
            )
            if bc_result["success"]:
                await db.inspection_reports.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {
                        "blockchain_tx_id": bc_result.get("tx_id"),
                        "blockchain_timestamp": bc_result.get("timestamp"),
                        "blockchain_recorded": True,
                        "islocked": True,
                    }},
                )
            else:
                print(f"⚠️ Failed to record on blockchain: {bc_result.get('error')}")
        except Exception as bc_err:
            print(f"⚠️ Blockchain recording error: {bc_err}")

        await db.pending_inspections.update_one(
            {"po_number": report.po_number},
            {"$set": {
                "status": f"Inspected - {report.status}",
                "inspection_report_id": inspection_report_id,
                "inspected_at": datetime.now(timezone.utc).isoformat(),
            }},
        )

        if report.status.lower() == "accepted":
            inspected_doc = {
                "po_number": report.po_number,
                "inspection_date": report.inspection_date,
                "inspected_by": report.inspected_by,
                "items": [item.dict() for item in report.items],
                "overall_remarks": report.overall_remarks or "",
                "status": report.status,
                "date_created": datetime.now(timezone.utc).isoformat(),
                "date_updated": None,
                "inspection_report_id": inspection_report_id,
            }
            await db.inspected.update_one(
                {"po_number": report.po_number},
                {"$set": inspected_doc},
                upsert=True,
            )
            inspected_record = await db.inspected.find_one({"po_number": report.po_number})
            inspected_id = str(inspected_record["_id"])

            try:
                bc2 = blockchain_client.record_inspection(
                    inspection_id=inspected_id,
                    po_number=report.po_number,
                    inspection_date=report.inspection_date,
                    inspected_by=report.inspected_by,
                    status=report.status,
                    items=[item.dict() for item in report.items],
                    overall_remarks=report.overall_remarks or "",
                )
                if bc2.get("success"):
                    await db.inspected.update_one(
                        {"_id": inspected_record["_id"]},
                        {"$set": {
                            "blockchain_tx_id": bc2.get("tx_id"),
                            "blockchain_timestamp": bc2.get("timestamp"),
                            "blockchain_recorded": True,
                            "islocked": True,
                        }},
                    )
            except Exception as bc_err2:
                print(f"⚠️ Blockchain error for accepted inspection: {bc_err2}")

            # Auto-create custodian slip for accepted items
            slip_counter = await db.counters.find_one_and_update(
                {"_id": "custodian_slip_id"},
                {"$inc": {"seq": 1}},
                upsert=True,
                return_document=True,
            )
            slip_seq = slip_counter.get("seq", 1) if slip_counter else 1
            slip_number = f"ICS-{datetime.now().strftime('%Y%m%d')}-{str(slip_seq).zfill(4)}"

            slip_items = [
                {
                    "item_description": item.item_description,
                    "property_number": None,
                    "quantity": item.quantity_received,
                    "unit": item.unit,
                    "unit_value": item.unit_price,
                    "total_value": item.unit_price * item.quantity_received,
                    "condition": item.condition,
                    "remarks": item.remarks or "",
                }
                for item in report.items
                if item.condition.lower() == "good" and item.quantity_received > 0
            ]

            if slip_items:
                pr = await db.purchase_requests.find_one({"pr_number": report.po_number})
                received_from = "N/A"
                if pr:
                    if pr.get("suppliers") and pr.get("selected_supplier_ids"):
                        sel = next(
                            (s for s in pr.get("suppliers", [])
                             if s.get("supplier_id") in pr.get("selected_supplier_ids", [])),
                            None,
                        )
                        received_from = (sel.get("name") if sel else None) or pr.get("entity_name", "N/A")
                    else:
                        received_from = pr.get("entity_name", "N/A")

                await db.custodian_slips.insert_one({
                    "slip_number": slip_number,
                    "date": report.inspection_date,
                    "received_from": received_from,
                    "received_by": report.inspected_by,
                    "items": slip_items,
                    "remarks": f"Auto-generated from Inspection Report {inspection_report_id}. "
                               f"{report.overall_remarks or ''}",
                    "status": "Submitted",
                    "inspection_report_id": inspection_report_id,
                    "date_created": datetime.now(timezone.utc).isoformat(),
                    "date_updated": None,
                })
                print(f"✅ Auto-created custodian slip {slip_number}")

        return InspectionReportResponse(**report_doc)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create inspection report error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.get("/api/inspection-reports", response_model=List[InspectionReportResponse])
async def get_inspection_reports(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        _require_token(credentials)
        db = await get_database()
        cursor = db.inspection_reports.find({}).sort("date_created", -1)
        reports = await cursor.to_list(length=None)
        result = []
        for report in reports:
            report["id"] = str(report["_id"])
            result.append(InspectionReportResponse(**report))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


# ---------------------------------------------------------------------------
# Inspected collection
# ---------------------------------------------------------------------------

@router.post("/api/inspected", response_model=dict)
async def create_inspected(
    report: CreateInspectionReport,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        _require_token(credentials)
        db = await get_database()
        inspected_doc = {
            "po_number": report.po_number,
            "inspection_date": report.inspection_date,
            "inspected_by": report.inspected_by,
            "items": [item.dict() for item in report.items],
            "overall_remarks": report.overall_remarks or "",
            "status": report.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None,
        }
        await db.inspected.update_one(
            {"po_number": report.po_number}, {"$set": inspected_doc}, upsert=True
        )
        try:
            record = await db.inspected.find_one({"po_number": report.po_number})
            inspected_id = str(record["_id"]) if record and record.get("_id") else None
            if inspected_id:
                blockchain_client = get_blockchain_client()
                bc = blockchain_client.record_inspection(
                    inspection_id=inspected_id,
                    po_number=report.po_number,
                    inspection_date=report.inspection_date,
                    inspected_by=report.inspected_by,
                    status=report.status,
                    items=[item.dict() for item in report.items],
                    overall_remarks=report.overall_remarks or "",
                )
                if bc.get("success"):
                    await db.inspected.update_one(
                        {"_id": record["_id"]},
                        {"$set": {
                            "blockchain_tx_id": bc.get("tx_id"),
                            "blockchain_timestamp": bc.get("timestamp"),
                            "blockchain_recorded": True,
                            "islocked": True,
                        }},
                    )
        except Exception as bc_err:
            print(f"⚠️ Blockchain error for /api/inspected: {bc_err}")

        return {"ok": True, "message": f"Record saved to Inspected collection for {report.po_number}",
                "po_number": report.po_number}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.get("/api/inspected", response_model=List[dict])
async def get_inspected(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        _require_token(credentials)
        db = await get_database()
        records = await db.inspected.find({}).sort("date_created", -1).to_list(length=None)
        result = []
        for r in records:
            r["id"] = str(r.pop("_id", ""))
            result.append(r)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


# ---------------------------------------------------------------------------
# Custodian Slips
# ---------------------------------------------------------------------------

@router.post("/api/custodian-slips", response_model=CustodianSlipResponse)
async def create_custodian_slip(
    slip: CreateCustodianSlip,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        _require_token(credentials)
        db = await get_database()
        slip_doc = {
            "slip_number": slip.slip_number,
            "date": slip.date,
            "received_from": slip.received_from,
            "received_by": slip.received_by,
            "items": [item.dict() for item in slip.items],
            "remarks": slip.remarks or "",
            "status": slip.status,
            "inspection_report_id": slip.inspection_report_id,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": None,
        }
        result = await db.custodian_slips.insert_one(slip_doc)
        slip_doc["id"] = str(result.inserted_id)
        return CustodianSlipResponse(**slip_doc)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create custodian slip error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


@router.get("/api/custodian-slips", response_model=List[CustodianSlipResponse])
async def get_custodian_slips(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        _require_token(credentials)
        db = await get_database()
        slips = await db.custodian_slips.find({}).sort("date_created", -1).to_list(length=None)
        result = []
        for slip in slips:
            slip["id"] = str(slip["_id"])
            result.append(CustodianSlipResponse(**slip))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An error occurred: {e}")


# ---------------------------------------------------------------------------
# Inventory Transfer Reports
# ---------------------------------------------------------------------------

@router.post("/api/inventory-transfer-reports")
async def create_inventory_transfer_report(
    transfer_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create a new inventory transfer report."""
    try:
        payload = _require_token(credentials)
        db = await get_database()
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "itr_no": transfer_data.get("itr_no", ""),
            "entity_name": transfer_data.get("entity_name", ""),
            "fund_cluster": transfer_data.get("fund_cluster", ""),
            "transfer_type": transfer_data.get("transfer_type", ""),
            "transfer_type_others": transfer_data.get("transfer_type_others", ""),
            "items": transfer_data.get("items", []),
            "reason_for_transfer": transfer_data.get("reason_for_transfer", ""),
            "approved_by": transfer_data.get("approved_by", ""),
            "released_issued_by": transfer_data.get("released_issued_by", ""),
            "received_by": transfer_data.get("received_by", ""),
            "date": transfer_data.get("date", ""),
            "status": transfer_data.get("status", "Draft"),
            "created_by": payload.get("sub", ""),
            "created_at": now, "updated_at": now,
        }
        result = await db.inventory_transfer_reports.insert_one(doc)
        return {"id": str(result.inserted_id), "itr_no": doc["itr_no"],
                "message": "Inventory Transfer Report created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error creating transfer report: {e}")


@router.get("/api/inventory-transfer-reports")
async def get_inventory_transfer_reports(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get all inventory transfer reports."""
    try:
        _require_token(credentials)
        db = await get_database()
        reports = await db.inventory_transfer_reports.find({}).sort("created_at", -1).to_list(length=None)
        result = []
        for report in reports:
            try:
                if "_id" in report:
                    report["id"] = str(report["_id"])
                    del report["_id"]
                result.append(report)
            except Exception as e:
                print(f"Error processing report: {e}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/inventory-transfer-reports: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching transfer reports: {e}")


@router.get("/api/inventory-transfer-reports/{itr_id}")
async def get_inventory_transfer_report(
    itr_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a specific inventory transfer report."""
    try:
        _require_token(credentials)
        db = await get_database()
        try:
            report = await db.inventory_transfer_reports.find_one({"_id": ObjectId(itr_id)})
        except Exception:
            report = None
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Transfer report not found")
        if "_id" in report:
            report["id"] = str(report["_id"])
            del report["_id"]
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching transfer report: {e}")


# ---------------------------------------------------------------------------
# Property Transfer Reports
# ---------------------------------------------------------------------------

@router.post("/api/property-transfer-reports")
async def create_property_transfer_report(
    transfer_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create a new property transfer report."""
    try:
        payload = _require_token(credentials)
        db = await get_database()
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "itr_no": transfer_data.get("itr_no", ""),
            "entity_name": transfer_data.get("entity_name", ""),
            "fund_cluster": transfer_data.get("fund_cluster", ""),
            "transfer_type": transfer_data.get("transfer_type", ""),
            "transfer_type_others": transfer_data.get("transfer_type_others", ""),
            "items": transfer_data.get("items", []),
            "reason_for_transfer": transfer_data.get("reason_for_transfer", ""),
            "approved_by": transfer_data.get("approved_by", ""),
            "released_issued_by": transfer_data.get("released_issued_by", ""),
            "received_by": transfer_data.get("received_by", ""),
            "date": transfer_data.get("date", ""),
            "status": transfer_data.get("status", "Draft"),
            "created_by": payload.get("sub", ""),
            "created_at": now, "updated_at": now,
        }
        result = await db.property_transfer_reports.insert_one(doc)
        return {"id": str(result.inserted_id), "itr_no": doc["itr_no"],
                "message": "Property Transfer Report created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error creating transfer report: {e}")


@router.get("/api/property-transfer-reports")
async def get_property_transfer_reports(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get all property transfer reports."""
    try:
        _require_token(credentials)
        db = await get_database()
        reports = await db.property_transfer_reports.find({}).sort("created_at", -1).to_list(length=None)
        result = []
        for report in reports:
            try:
                if "_id" in report:
                    report["id"] = str(report["_id"])
                    del report["_id"]
                result.append(report)
            except Exception as e:
                print(f"Error processing report: {e}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in GET /api/property-transfer-reports: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching transfer reports: {e}")


@router.get("/api/property-transfer-reports/{ptr_id}")
async def get_property_transfer_report(
    ptr_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a specific property transfer report."""
    try:
        _require_token(credentials)
        db = await get_database()
        try:
            report = await db.property_transfer_reports.find_one({"_id": ObjectId(ptr_id)})
        except Exception:
            report = None
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Transfer report not found")
        if "_id" in report:
            report["id"] = str(report["_id"])
            del report["_id"]
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching transfer report: {e}")


# ---------------------------------------------------------------------------
# Property Return Slips
# ---------------------------------------------------------------------------

@router.post("/api/property-return-slips", response_model=PropertyReturnSlipResponse)
async def create_property_return_slip(
    slip_data: CreatePropertyReturnSlip,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create a new property return slip."""
    try:
        _require_token(credentials)
        db = await get_database()
        slip_doc = {
            "prs_no": slip_data.prs_no,
            "entity_name": slip_data.entity_name,
            "return_type": slip_data.return_type,
            "return_type_others": slip_data.return_type_others or "",
            "items": [item.dict() for item in slip_data.items],
            "returned_by": slip_data.returned_by,
            "returned_by_designation": slip_data.returned_by_designation or "",
            "returned_by_office": slip_data.returned_by_office or "",
            "returned_date": slip_data.returned_date,
            "received_by": slip_data.received_by,
            "noted_by": slip_data.noted_by,
            "status": slip_data.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.property_return_slips.insert_one(slip_doc)
        slip_doc["id"] = str(result.inserted_id)
        slip_doc.pop("_id", None)
        return slip_doc
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in POST /api/property-return-slips: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error creating property return slip: {e}")


@router.get("/api/property-return-slips", response_model=list)
async def get_property_return_slips(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get all property return slips."""
    try:
        _require_token(credentials)
        db = await get_database()
        slips = await db.property_return_slips.find().to_list(None)
        for slip in slips:
            if "_id" in slip:
                slip["id"] = str(slip["_id"])
                del slip["_id"]
        return slips
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching property return slips: {e}")


@router.get("/api/property-return-slips/{slip_id}")
async def get_property_return_slip(
    slip_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a specific property return slip."""
    try:
        _require_token(credentials)
        db = await get_database()
        try:
            slip = await db.property_return_slips.find_one({"_id": ObjectId(slip_id)})
        except Exception:
            slip = None
        if not slip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Property return slip not found")
        if "_id" in slip:
            slip["id"] = str(slip["_id"])
            del slip["_id"]
        return slip
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching property return slip: {e}")


# ---------------------------------------------------------------------------
# Waste Materials Reports
# ---------------------------------------------------------------------------

@router.post("/api/waste-materials-reports", response_model=WasteMaterialsReportResponse)
async def create_waste_materials_report(
    report_data: CreateWasteMaterialsReport,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create a new waste materials report."""
    try:
        _require_token(credentials)
        db = await get_database()
        report_doc = {
            "report_number": report_data.report_number,
            "agency": report_data.agency,
            "place_of_storage": report_data.place_of_storage,
            "report_date": report_data.report_date,
            "certified_by": report_data.certified_by,
            "certified_by_designation": report_data.certified_by_designation or "",
            "approved_by": report_data.approved_by,
            "approved_by_designation": report_data.approved_by_designation or "",
            "property_inspector": report_data.property_inspector or "",
            "witness_to_disposition": report_data.witness_to_disposition or "",
            "items": [item.dict() for item in report_data.items],
            "total_amount": report_data.total_amount,
            "status": report_data.status,
            "date_created": datetime.now(timezone.utc).isoformat(),
            "date_updated": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.waste_materials_reports.insert_one(report_doc)
        report_doc["id"] = str(result.inserted_id)
        report_doc.pop("_id", None)
        return report_doc
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in POST /api/waste-materials-reports: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error creating waste materials report: {e}")


@router.get("/api/waste-materials-reports", response_model=list)
async def get_waste_materials_reports(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get all waste materials reports."""
    try:
        _require_token(credentials)
        db = await get_database()
        reports = await db.waste_materials_reports.find().to_list(None)
        for report in reports:
            if "_id" in report:
                report["id"] = str(report["_id"])
                del report["_id"]
        return reports
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching waste materials reports: {e}")


@router.get("/api/waste-materials-reports/{report_id}", response_model=WasteMaterialsReportResponse)
async def get_waste_materials_report(
    report_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a specific waste materials report."""
    try:
        _require_token(credentials)
        db = await get_database()
        report = await db.waste_materials_reports.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Waste materials report not found")
        report["id"] = str(report["_id"])
        del report["_id"]
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching waste materials report: {e}")
