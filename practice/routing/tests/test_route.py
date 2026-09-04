import json
import unittest
from pathlib import Path

from routing.route import route_order

ROOT = Path(__file__).resolve().parents[1]
PARTNERS = json.loads((ROOT / "data" / "partners.json").read_text())
ORDERS = {o["id"]: o for o in json.loads((ROOT / "data" / "orders.json").read_text())}


class RouteTests(unittest.TestCase):
    def test_r01_fastest_cairo_oral(self):
        out = route_order(ORDERS["R-01"], PARTNERS)
        self.assertEqual(out["decision"], "assign")
        self.assertEqual(out["partner_id"], "cairo_hospital_pharmacy")

    def test_r02_pin_wins(self):
        out = route_order(ORDERS["R-02"], PARTNERS)
        self.assertEqual(out["partner_id"], "ngo_central_store")

    def test_r03_cold_red_sea_no_partner(self):
        out = route_order(ORDERS["R-03"], PARTNERS)
        self.assertEqual(out["decision"], "decline")

    def test_r04_oral_red_sea_depot(self):
        out = route_order(ORDERS["R-04"], PARTNERS)
        self.assertEqual(out["partner_id"], "red_sea_depot")

    def test_r05_incomplete_query(self):
        out = route_order(ORDERS["R-05"], PARTNERS)
        self.assertEqual(out["decision"], "query")


if __name__ == "__main__":
    unittest.main()
