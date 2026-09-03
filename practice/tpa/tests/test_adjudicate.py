import json
import unittest
from pathlib import Path

from tpa.adjudicate import adjudicate

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = json.loads((ROOT / "data" / "claims.json").read_text(encoding="utf-8"))
MEMBERS = {m["id"]: m for m in PAYLOAD["members"]}
POLICIES = {p["id"]: p for p in PAYLOAD["policies"]}
CLAIMS = {c["id"]: c for c in PAYLOAD["claims"]}
PRIOR = PAYLOAD["prior_paid"]


def run(cid: str):
    claim = CLAIMS[cid]
    member = MEMBERS[claim["member_id"]]
    policy = POLICIES[member["policy_id"]]
    return adjudicate(claim, member, policy, PRIOR)


class AdjudicateTests(unittest.TestCase):
    def test_clean_cashless_pays_tariff_minus_copay(self):
        d = run("C-01")
        self.assertEqual((d.code, d.allowed, d.plan_pay, d.member_pay), ("pay", 300, 250, 50))

    def test_inactive_member_denied(self):
        self.assertEqual(run("C-02").failed_gate, "eligibility")

    def test_mri_without_auth_denied(self):
        self.assertEqual(run("C-03").failed_gate, "authorization")

    def test_extra_mri_unit_is_partial(self):
        self.assertEqual(run("C-04").code, "partial")

    def test_reimbursement_without_receipt_pends(self):
        self.assertEqual(run("C-05").code, "pend")


if __name__ == "__main__":
    unittest.main()
