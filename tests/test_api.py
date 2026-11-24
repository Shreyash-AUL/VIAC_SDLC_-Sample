import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient

from backend.app.database import Base, engine
from backend.app.main import app


class PolicyAdministrationApiTests(unittest.TestCase):
    def setUp(self) -> None:
        Base.metadata.drop_all(bind=engine)
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)
        Base.metadata.drop_all(bind=engine)

    @property
    def auth(self) -> dict[str, str]:
        return {"Authorization": "Bearer local-demo-token"}

    def test_seeded_dashboard_uses_synthetic_demo_records(self) -> None:
        response = self.client.get("/api/dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["demo_mode"])
        self.assertEqual(response.json()["customers"], 3)
        self.assertEqual(response.json()["active_policies"], 2)

    def test_policy_lifecycle_and_claim_registration(self) -> None:
        customer_id = self.client.get("/api/customers").json()[0]["id"]
        product_id = self.client.get("/api/products").json()[0]["id"]
        created = self.client.post(
            "/api/policies", headers=self.auth,
            json={"customer_id": customer_id, "product_id": product_id},
        )
        self.assertEqual(created.status_code, 201)
        policy = created.json()
        self.assertEqual(policy["status"], "Draft")
        issued = self.client.post(f"/api/policies/{policy['id']}/issue", headers=self.auth)
        self.assertEqual(issued.status_code, 200)
        self.assertEqual(issued.json()["status"], "Active")
        claim = self.client.post(
            "/api/claims", headers=self.auth,
            json={"policy_id": policy["id"], "amount": 1000, "description": "Synthetic test claim"},
        )
        self.assertEqual(claim.status_code, 201)
        self.assertEqual(claim.json()["status"], "Submitted")

    def test_workflow_runs_all_agents_and_requires_human_approval(self) -> None:
        created = self.client.post(
            "/api/workflows", headers=self.auth,
            json={"requirement": "Add beneficiary management to new life policies"},
        )
        self.assertEqual(created.status_code, 201)
        workflow = created.json()
        self.assertEqual(len(workflow["executions"]), 9)
        self.assertEqual(workflow["executions"][0]["agent_name"], "Business Analyst")
        self.assertEqual(workflow["approval"]["status"], "Pending")
        approved = self.client.post(
            f"/api/workflows/{workflow['id']}/approval", headers=self.auth,
            json={"decision": "Approved", "note": "Reviewed by test operator"},
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["approval"]["status"], "Approved")
        self.assertEqual(approved.json()["current_phase"], "Approved for deployment")

    def test_mutations_require_demo_bearer_token(self) -> None:
        response = self.client.post(
            "/api/customers",
            json={"name": "Demo Person", "email": "demo.person@example.com", "phone": ""},
        )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
