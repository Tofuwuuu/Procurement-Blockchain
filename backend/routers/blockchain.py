"""
Blockchain audit routes:
  /api/blockchain/events*  and  /api/blockchain/inspections*
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import traceback

from database import get_database
from auth import decode_access_token
from api.blockchain_client import get_blockchain_client
from routers.deps import security, get_authenticated_user_context

router = APIRouter(prefix="/api/blockchain", tags=["blockchain"])


def _inspection_to_event(inspection: dict, source: str = "fabric") -> dict:
    inspection_id = (
        inspection.get("inspectionId") or inspection.get("inspection_id")
        or inspection.get("id") or str(inspection.get("_id", ""))
        or inspection.get("txId") or inspection.get("tx_id")
    )
    po_number = inspection.get("poNumber") or inspection.get("po_number") or ""
    timestamp = (
        inspection.get("timestamp") or inspection.get("blockchain_timestamp")
        or inspection.get("createdAt") or inspection.get("date_created")
        or inspection.get("inspectionDate") or inspection.get("inspection_date") or ""
    )
    transaction_id = (
        inspection.get("txId") or inspection.get("tx_id")
        or inspection.get("blockchain_tx_id") or ""
    )
    return {
        "event_id": f"INSP-{inspection_id}" if inspection_id else f"INSP-{transaction_id}",
        "event_type": "INSPECTION_RECORDED",
        "timestamp": timestamp,
        "performed_by": inspection.get("inspectedBy") or inspection.get("inspected_by") or "",
        "transaction_id": transaction_id,
        "status": inspection.get("status") or "",
        "details": {
            "inspection_id": inspection_id,
            "po_number": po_number,
            "inspection_date": inspection.get("inspectionDate") or inspection.get("inspection_date") or "",
            "items": inspection.get("items") or [],
            "overall_remarks": inspection.get("overallRemarks") or inspection.get("overall_remarks") or "",
            "creator_msp_id": inspection.get("creatorMspId") or inspection.get("creator_msp_id") or "",
            "locked": bool(
                inspection.get("locked") or inspection.get("islocked")
                or inspection.get("blockchain_recorded")
            ),
            "source": source,
        },
    }


# ---------------------------------------------------------------------------
# Procurement Events
# ---------------------------------------------------------------------------

@router.get("/events")
async def get_blockchain_procurement_events(
    event_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Return inspection-derived blockchain events from Fabric inspection records."""
    await get_authenticated_user_context(credentials)

    def apply_filters(events: list) -> list:
        filtered = events
        if event_type:
            filtered = [e for e in filtered if e["event_type"] == event_type]
        if entity_id:
            filtered = [
                e for e in filtered
                if entity_id in {
                    str(e.get("event_id", "")),
                    str(e.get("details", {}).get("inspection_id", "")),
                    str(e.get("details", {}).get("po_number", "")),
                }
            ]
        return filtered

    try:
        blockchain_client = get_blockchain_client()
        result = blockchain_client.get_all_inspections()

        if result.get("success"):
            inspections = result.get("data", [])
            if not isinstance(inspections, list):
                inspections = []
            events = [_inspection_to_event(i, "fabric") for i in inspections]
            return {"events": apply_filters(events), "total": len(events), "source": "fabric"}

        db = await get_database()
        cursor = db.inspected.find({
            "$or": [
                {"blockchain_recorded": True},
                {"blockchain_tx_id": {"$exists": True, "$ne": None}},
                {"islocked": True},
                {"isLocked": True},
            ]
        }).sort("blockchain_timestamp", -1)
        docs = await cursor.to_list(length=None)
        events = []
        for doc in docs:
            if "_id" in doc:
                doc["id"] = str(doc["_id"])
                del doc["_id"]
            events.append(_inspection_to_event(doc, "database_fallback"))
        events = apply_filters(events)
        return {
            "events": events,
            "total": len(events),
            "source": "database_fallback",
            "warning": result.get("error",
                                  "Fabric query failed; showing locally stored blockchain metadata"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching blockchain procurement events: {e}")


@router.get("/events/{event_id}")
async def get_blockchain_procurement_event(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    await get_authenticated_user_context(credentials)
    blockchain_client = get_blockchain_client()
    result = blockchain_client.get_procurement_event(event_id)
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=result.get("error", "Event not found"))
    return result.get("data")


@router.get("/events/{event_id}/verify")
async def verify_blockchain_procurement_event(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    await get_authenticated_user_context(credentials)
    blockchain_client = get_blockchain_client()
    result = blockchain_client.verify_procurement_event(event_id)
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=result.get("error", "Event not found"))
    return result.get("data")


# ---------------------------------------------------------------------------
# Blockchain Inspection Records
# ---------------------------------------------------------------------------

@router.get("/inspections")
async def get_blockchain_inspections(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Return all Accepted records from the `inspected` collection with blockchain sync metadata.
    Does NOT attempt to sync (use POST /sync for that).
    """
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")

        db = await get_database()
        reports = await db.inspected.find({"status": "Accepted"}).sort("date_created", -1).to_list(length=None)

        result = []
        for report in reports:
            report_id = str(report["_id"])
            islocked = report.get("islocked", False) or report.get("isLocked", False)
            blockchain_recorded = report.get("blockchain_recorded", False)
            result.append({
                "id": report_id,
                "po_number": report.get("po_number", ""),
                "inspection_date": report.get("inspection_date", ""),
                "inspected_by": report.get("inspected_by", ""),
                "status": report.get("status", "Accepted"),
                "items": report.get("items", []),
                "overall_remarks": report.get("overall_remarks", ""),
                "date_created": report.get("date_created", ""),
                "date_updated": report.get("date_updated"),
                "blockchain_tx_id": report.get("blockchain_tx_id"),
                "blockchain_timestamp": report.get("blockchain_timestamp"),
                "blockchain_recorded": blockchain_recorded,
                "islocked": islocked,
                "blockchain_data": {
                    "inspectionId": report_id,
                    "timestamp": report.get("blockchain_timestamp") or report.get("date_created", ""),
                    "locked": islocked,
                    "txId": report.get("blockchain_tx_id") or "pending",
                } if blockchain_recorded else None,
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching blockchain inspections: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching blockchain inspections: {e}")


@router.get("/inspections/po/{po_number}")
async def get_blockchain_inspections_by_po(
    po_number: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get inspection records by PO number from blockchain."""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")
        blockchain_client = get_blockchain_client()
        result = blockchain_client.get_inspection_by_po(po_number)
        if result["success"]:
            return result["data"]
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=result.get("error", "Inspections not found on blockchain"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching blockchain inspections: {e}")


@router.get("/inspections/{inspection_id}/verify")
async def verify_blockchain_inspection(
    inspection_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Verify the integrity of an inspection record on blockchain."""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")

        db = await get_database()
        try:
            inspected_doc = await db.inspected.find_one({"_id": ObjectId(inspection_id)})
        except Exception:
            inspected_doc = None

        if inspected_doc and not inspected_doc.get("blockchain_recorded"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="This record is not synced to blockchain yet. Sync it first.")

        blockchain_client = get_blockchain_client()
        result = blockchain_client.verify_inspection(inspection_id)
        if result["success"]:
            return result["data"]
        err = (result.get("error") or "").lower()
        if "deadline" in err or "failed to connect" in err or "connection" in err:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Blockchain network is unreachable. Please try again later.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=result.get("error", "Inspection not found on blockchain"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error verifying blockchain inspection: {e}")


@router.get("/inspections/{inspection_id}")
async def get_blockchain_inspection(
    inspection_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a specific inspection record from blockchain."""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")
        blockchain_client = get_blockchain_client()
        result = blockchain_client.get_inspection(inspection_id)
        if result["success"]:
            return result["data"]
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=result.get("error", "Inspection not found on blockchain"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error fetching blockchain inspection: {e}")


@router.post("/inspections/sync")
async def sync_inspections_to_blockchain(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Manually sync all unsynced accepted inspection records to blockchain."""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid or expired token")

        blockchain_client = get_blockchain_client()
        db = await get_database()
        cursor = db.inspected.find({
            "status": "Accepted",
            "$or": [
                {"blockchain_recorded": {"$ne": True}},
                {"blockchain_recorded": None},
                {"blockchain_tx_id": {"$exists": False}},
            ],
        }).sort("date_created", -1)
        reports = await cursor.to_list(length=None)

        synced_count = failed_count = 0
        results = []
        for report in reports:
            report_id = str(report["_id"])
            try:
                bc = blockchain_client.record_inspection(
                    inspection_id=report_id,
                    po_number=report.get("po_number", ""),
                    inspection_date=report.get("inspection_date", ""),
                    inspected_by=report.get("inspected_by", ""),
                    status=report.get("status", "Accepted"),
                    items=report.get("items", []),
                    overall_remarks=report.get("overall_remarks", ""),
                )
                if bc.get("success"):
                    await db.inspected.update_one(
                        {"_id": ObjectId(report_id)},
                        {"$set": {
                            "blockchain_tx_id": bc.get("tx_id"),
                            "blockchain_timestamp": bc.get("timestamp"),
                            "blockchain_recorded": True,
                            "islocked": True,
                        }},
                    )
                    synced_count += 1
                    results.append({"inspection_id": report_id,
                                    "po_number": report.get("po_number"),
                                    "status": "success", "tx_id": bc.get("tx_id")})
                else:
                    failed_count += 1
                    results.append({"inspection_id": report_id,
                                    "po_number": report.get("po_number"),
                                    "status": "failed", "error": bc.get("error")})
            except Exception as sync_err:
                failed_count += 1
                results.append({"inspection_id": report_id,
                                 "po_number": report.get("po_number"),
                                 "status": "error", "error": str(sync_err)})

        return {
            "success": True,
            "message": f"Sync completed: {synced_count} synced, {failed_count} failed",
            "synced_count": synced_count,
            "failed_count": failed_count,
            "total": len(reports),
            "results": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error syncing inspections: {e}")
