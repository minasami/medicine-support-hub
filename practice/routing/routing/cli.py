import json
import sys
from pathlib import Path

from routing.route import route_order


def main() -> None:
    orders_path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/orders.json")
    partners_path = orders_path.parent / "partners.json"
    partners = json.loads(partners_path.read_text())
    orders = json.loads(orders_path.read_text())
    for order in orders:
        out = route_order(order, partners)
        print(f"{out['order_id']}\t{out['decision']}\t{out['partner_id']}\t{out['reason']}")


if __name__ == "__main__":
    main()
