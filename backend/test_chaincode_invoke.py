from api.blockchain_client import BlockchainClient
import time


def main() -> None:
    bc = BlockchainClient()

    items = [
        {"item": "WidgetA", "qty": 5, "result": "Accepted", "remarks": "OK"},
    ]

    print("Invoking record_inspection (first time)...")
    r = bc.record_inspection(
        inspection_id="INSP001",
        po_number="PO-1001",
        inspection_date="2026-01-28T07:49:00Z",
        inspected_by="Inspector A",
        status="Accepted",
        items=items,
        overall_remarks="All good",
    )
    print(r)

    time.sleep(3)

    print("\nInvoking record_inspection (second time; should be idempotent)...")
    r2 = bc.record_inspection(
        inspection_id="INSP001",
        po_number="PO-1001",
        inspection_date="2026-01-28T07:49:00Z",
        inspected_by="Inspector A",
        status="Accepted",
        items=items,
        overall_remarks="All good",
    )
    print(r2)

    print("\nQuerying get_inspection...")
    q = bc.get_inspection("INSP001")
    print(q)

    print("\nQuerying verify_inspection...")
    v = bc.verify_inspection("INSP001")
    print(v)


if __name__ == "__main__":
    main()

