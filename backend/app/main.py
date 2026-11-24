from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from backend.app.config import settings
from backend.app.database import Base, engine, get_db
from backend.app.models import (
    Approval,
    AuditLog,
    Claim,
    Customer,
    Payment,
    Policy,
    Product,
    WorkflowRun,
)
from backend.app.orchestrator import run_workflow
from backend.app.schemas import (
    ApprovalDecision,
    ClaimCreate,
    CustomerCreate,
    CustomerOut,
    PaymentCreate,
    PolicyCreate,
    WorkflowCreate,
)
from backend.app.agents import workflow_summary

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Synthetic-data insurance administration and demo SDLC orchestration.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def _actor(authorization: str | None = Header(default=None)) -> str:
    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configure an OIDC identity provider before enabling non-demo mode.",
        )
    expected = f"Bearer {settings.demo_token}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Valid demo bearer token required.")
    return "demo-operator"


def _audit(db: Session, actor: str, action: str, entity: str, entity_id: int) -> None:
    db.add(AuditLog(actor=actor, action=action, entity=entity, entity_id=str(entity_id)))


def _seed_demo_data(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(Product)):
        return
    customers = [
        Customer(name="Jordan Lee", email="jordan.lee@example.com", phone="555-0101"),
        Customer(name="Morgan Patel", email="morgan.patel@example.com", phone="555-0102"),
        Customer(name="Taylor Chen", email="taylor.chen@example.com", phone="555-0103"),
    ]
    products = [
        Product(code="TERM-20", name="SecureLife Term 20", category="Life", base_premium=86.50, coverage_amount=250000),
        Product(code="FIX-ANN", name="SteadyPath Fixed Annuity", category="Fixed Annuity", base_premium=325.00, coverage_amount=100000),
        Product(code="VAR-ANN", name="Horizon Variable Annuity", category="Variable Annuity", base_premium=410.00, coverage_amount=150000),
    ]
    db.add_all(customers + products)
    db.flush()
    policies = [
        Policy(policy_number="DEMO-1001", customer_id=customers[0].id, product_id=products[0].id,
               status="Active", premium=86.50, coverage_amount=250000),
        Policy(policy_number="DEMO-1002", customer_id=customers[1].id, product_id=products[1].id,
               status="Active", premium=325.00, coverage_amount=100000),
        Policy(policy_number="DEMO-1003", customer_id=customers[2].id, product_id=products[2].id,
               status="Pending", premium=410.00, coverage_amount=150000),
    ]
    db.add_all(policies)
    db.flush()
    db.add_all([
        Claim(claim_number="CLM-24001", policy_id=policies[0].id, amount=12500, status="Under Review",
              description="Synthetic demonstration claim"),
        Payment(policy_id=policies[0].id, amount=86.50, status="Recorded",
                reference="DEMO-PAY-1001"),
        Payment(policy_id=policies[1].id, amount=325.00, status="Recorded",
                reference="DEMO-PAY-1002"),
    ])
    db.commit()


@app.on_event("startup")
def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        _seed_demo_data(db)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mode": "demo" if settings.demo_mode else "production-config-required"}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)) -> dict:
    latest = db.scalar(select(WorkflowRun).options(joinedload(WorkflowRun.approval)).order_by(WorkflowRun.id.desc()))
    open_approvals = db.scalar(select(func.count()).select_from(Approval).where(Approval.status == "Pending")) or 0
    return {
        "customers": db.scalar(select(func.count()).select_from(Customer)) or 0,
        "active_policies": db.scalar(select(func.count()).select_from(Policy).where(Policy.status == "Active")) or 0,
        "pending_policies": db.scalar(select(func.count()).select_from(Policy).where(Policy.status == "Pending")) or 0,
        "open_claims": db.scalar(select(func.count()).select_from(Claim).where(Claim.status != "Settled")) or 0,
        "premium_collected": db.scalar(select(func.coalesce(func.sum(Payment.amount), 0))) or 0,
        "pending_approvals": open_approvals,
        "latest_workflow": workflow_summary(latest) if latest else None,
        "demo_mode": settings.demo_mode,
    }


@app.get("/api/customers", response_model=list[CustomerOut])
def list_customers(db: Session = Depends(get_db)) -> list[Customer]:
    return list(db.scalars(select(Customer).order_by(Customer.name)).all())


@app.post("/api/customers", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, actor: str = Depends(_actor), db: Session = Depends(get_db)) -> Customer:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    try:
        db.flush()
        _audit(db, actor, "customer.created", "customer", customer.id)
        db.commit()
        db.refresh(customer)
        return customer
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A customer with this email already exists.") from exc


@app.get("/api/products")
def list_products(db: Session = Depends(get_db)) -> list[dict]:
    products = db.scalars(select(Product).where(Product.active.is_(True)).order_by(Product.name)).all()
    return [
        {"id": p.id, "code": p.code, "name": p.name, "category": p.category,
         "base_premium": p.base_premium, "coverage_amount": p.coverage_amount}
        for p in products
    ]


def _policy_out(policy: Policy) -> dict:
    return {
        "id": policy.id,
        "policy_number": policy.policy_number,
        "customer_id": policy.customer_id,
        "customer_name": policy.customer.name,
        "product_name": policy.product.name,
        "status": policy.status,
        "premium": policy.premium,
        "coverage_amount": policy.coverage_amount,
    }


@app.get("/api/policies")
def list_policies(db: Session = Depends(get_db)) -> list[dict]:
    policies = db.scalars(
        select(Policy).options(joinedload(Policy.customer), joinedload(Policy.product)).order_by(Policy.id.desc())
    ).all()
    return [_policy_out(policy) for policy in policies]


@app.post("/api/policies", status_code=201)
def create_policy(payload: PolicyCreate, actor: str = Depends(_actor), db: Session = Depends(get_db)) -> dict:
    customer = db.get(Customer, payload.customer_id)
    product = db.get(Product, payload.product_id)
    if customer is None or product is None or not product.active:
        raise HTTPException(status_code=404, detail="Active customer and product are required.")
    policy = Policy(
        policy_number=f"PAS-{uuid4().hex[:10].upper()}",
        customer_id=customer.id,
        product_id=product.id,
        status="Draft",
        premium=product.base_premium,
        coverage_amount=product.coverage_amount,
    )
    db.add(policy)
    db.flush()
    _audit(db, actor, "policy.created", "policy", policy.id)
    db.commit()
    db.refresh(policy)
    return _policy_out(policy)


@app.post("/api/policies/{policy_id}/issue")
def issue_policy(policy_id: int, actor: str = Depends(_actor), db: Session = Depends(get_db)) -> dict:
    policy = db.scalar(
        select(Policy).options(joinedload(Policy.customer), joinedload(Policy.product))
        .where(Policy.id == policy_id)
    )
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found.")
    if policy.status != "Draft":
        raise HTTPException(status_code=409, detail="Only draft policies can be issued.")
    policy.status = "Active"
    _audit(db, actor, "policy.issued", "policy", policy.id)
    db.commit()
    return _policy_out(policy)


@app.get("/api/claims")
def list_claims(db: Session = Depends(get_db)) -> list[dict]:
    claims = db.scalars(select(Claim).options(joinedload(Claim.policy)).order_by(Claim.id.desc())).all()
    return [
        {"id": claim.id, "claim_number": claim.claim_number, "policy_number": claim.policy.policy_number,
         "amount": claim.amount, "status": claim.status, "description": claim.description}
        for claim in claims
    ]


@app.post("/api/claims", status_code=201)
def create_claim(payload: ClaimCreate, actor: str = Depends(_actor), db: Session = Depends(get_db)) -> dict:
    policy = db.get(Policy, payload.policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found.")
    if policy.status != "Active":
        raise HTTPException(status_code=409, detail="Claims can only be registered against active policies.")
    claim = Claim(
        claim_number=f"CLM-{uuid4().hex[:10].upper()}",
        policy_id=policy.id,
        amount=payload.amount,
        description=payload.description,
        status="Submitted",
    )
    db.add(claim)
    db.flush()
    _audit(db, actor, "claim.registered", "claim", claim.id)
    db.commit()
    return {"id": claim.id, "claim_number": claim.claim_number, "policy_number": policy.policy_number,
            "amount": claim.amount, "status": claim.status, "description": claim.description}


@app.get("/api/payments")
def list_payments(db: Session = Depends(get_db)) -> list[dict]:
    payments = db.scalars(select(Payment).options(joinedload(Payment.policy)).order_by(Payment.id.desc())).all()
    return [
        {"id": payment.id, "reference": payment.reference, "policy_number": payment.policy.policy_number,
         "amount": payment.amount, "status": payment.status}
        for payment in payments
    ]


@app.post("/api/payments", status_code=201)
def record_payment(payload: PaymentCreate, actor: str = Depends(_actor), db: Session = Depends(get_db)) -> dict:
    policy = db.get(Policy, payload.policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found.")
    if policy.status != "Active":
        raise HTTPException(status_code=409, detail="Payments can only be recorded for active policies.")
    payment = Payment(
        policy_id=policy.id, amount=payload.amount, status="Recorded",
        reference=f"MOCK-{uuid4().hex[:12].upper()}",
    )
    db.add(payment)
    db.flush()
    _audit(db, actor, "payment.recorded.mock", "payment", payment.id)
    db.commit()
    return {"id": payment.id, "reference": payment.reference, "policy_number": policy.policy_number,
            "amount": payment.amount, "status": payment.status, "integration": "mock"}


@app.get("/api/workflows")
def list_workflows(db: Session = Depends(get_db)) -> list[dict]:
    workflows = db.scalars(
        select(WorkflowRun).options(joinedload(WorkflowRun.approval), joinedload(WorkflowRun.executions))
        .order_by(WorkflowRun.id.desc())
    ).unique().all()
    return [workflow_summary(item) for item in workflows]


@app.post("/api/workflows", status_code=201)
def create_workflow(payload: WorkflowCreate, actor: str = Depends(_actor), db: Session = Depends(get_db)) -> dict:
    workflow = run_workflow(db, payload.requirement)
    _audit(db, actor, "sdlc.workflow.completed", "workflow", workflow.id)
    db.commit()
    return workflow_summary(workflow)


@app.get("/api/workflows/{workflow_id}")
def get_workflow(workflow_id: int, db: Session = Depends(get_db)) -> dict:
    workflow = db.scalar(
        select(WorkflowRun).options(joinedload(WorkflowRun.approval), joinedload(WorkflowRun.executions))
        .where(WorkflowRun.id == workflow_id)
    )
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    return workflow_summary(workflow)


@app.post("/api/workflows/{workflow_id}/approval")
def decide_approval(
    workflow_id: int,
    payload: ApprovalDecision,
    actor: str = Depends(_actor),
    db: Session = Depends(get_db),
) -> dict:
    workflow = db.scalar(select(WorkflowRun).options(joinedload(WorkflowRun.approval)).where(WorkflowRun.id == workflow_id))
    if workflow is None or workflow.approval is None:
        raise HTTPException(status_code=404, detail="Workflow approval not found.")
    if workflow.approval.status != "Pending":
        raise HTTPException(status_code=409, detail="This workflow has already received a decision.")
    workflow.approval.status = payload.decision
    workflow.approval.approver = actor
    workflow.approval.note = payload.note
    workflow.approval.decided_at = datetime.now(timezone.utc)
    workflow.current_phase = "Approved for deployment" if payload.decision == "Approved" else "Rejected"
    _audit(db, actor, f"sdlc.deployment.{payload.decision.lower()}", "workflow", workflow.id)
    db.commit()
    db.refresh(workflow)
    return workflow_summary(workflow)
