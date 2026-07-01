"""One-shot script to sync accepted inspections from MongoDB to Fabric."""

import asyncio
from bson import ObjectId

from api.blockchain_client import get_blockchain_client
from database import close_mongo_connection, connect_to_mongo, get_database


async def main() -> None:
    await connect_to_mongo()
    db = await get_database()
    client = get_blockchain_client()

    reports = await db.inspected.find({"status": "Accepted"}).sort("date_created", -1).to_list(length=None)

    synced = failed = 0
    for report in reports:
        report_id = str(report["_id"])
        result = client.record_inspection(
            inspection_id=report_id,
            po_number=report.get("po_number", ""),
            inspection_date=report.get("inspection_date", ""),
            inspected_by=report.get("inspected_by", ""),
            status=report.get("status", "Accepted"),
            items=report.get("items", []),
            overall_remarks=report.get("overall_remarks", ""),
        )
        if result.get("success"):
            await db.inspected.update_one(
                {"_id": ObjectId(report_id)},
                {"$set": {
                    "blockchain_tx_id": result.get("tx_id"),
                    "blockchain_timestamp": result.get("timestamp"),
                    "blockchain_recorded": True,
                    "islocked": True,
                }},
            )
            synced += 1
            print(f"OK {report.get('po_number')} tx={result.get('tx_id')}")
        else:
            failed += 1
            print(f"FAIL {report.get('po_number')}: {result.get('error')}")

    print(f"Done: {synced} synced, {failed} failed, {len(reports)} total")
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
