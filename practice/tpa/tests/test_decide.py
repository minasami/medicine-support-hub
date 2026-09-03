import json
import unittest
from pathlib import Path

from tpa.decide import decide

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = json.loads((ROOT / "data" / "tickets.json").read_text(encoding="utf-8"))
MEMBERS = {m["id"]: m for m in PAYLOAD["members"]}
POLICIES = {p["id"]: p for p in PAYLOAD["policies"]}
TICKETS = {t["id"]: t for t in PAYLOAD["tickets"]}


def run(ticket_id: str):
    ticket = TICKETS[ticket_id]
    member = MEMBERS[ticket["member_id"]]
    policy = POLICIES[member["policy_id"]]
    return decide(ticket, member, policy)


class DecideTests(unittest.TestCase):
    def test_clean_consult_approves(self):
        self.assertEqual(run("T-01").code, "approve")

    def test_inactive_member_declines_before_medicine(self):
        d = run("T-02")
        self.assertEqual(d.code, "decline")
        self.assertEqual(d.failed_gate, "eligibility")

    def test_incomplete_imaging_queries(self):
        self.assertEqual(run("T-03").failed_gate, "completeness")

    def test_complete_mri_approves(self):
        self.assertEqual(run("T-04").code, "approve")

    def test_over_limit_is_partial(self):
        self.assertEqual(run("T-05").code, "partial")

    def test_excluded_service_declines(self):
        self.assertEqual(run("T-06").failed_gate, "coverage")

    def test_repeat_imaging_needs_justification(self):
        self.assertEqual(run("T-07").failed_gate, "necessity")

    def test_high_cost_does_not_self_approve(self):
        self.assertIn("escalate", run("T-08").reason.lower())


if __name__ == "__main__":
    unittest.main()
