from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone: str = Field(default="", max_length=40)


class CustomerOut(CustomerCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class PolicyCreate(BaseModel):
    customer_id: int
    product_id: int


class ClaimCreate(BaseModel):
    policy_id: int
    amount: float = Field(gt=0)
    description: str = Field(min_length=5, max_length=2000)


class PaymentCreate(BaseModel):
    policy_id: int
    amount: float = Field(gt=0)


class WorkflowCreate(BaseModel):
    requirement: str = Field(min_length=10, max_length=5000)


class ApprovalDecision(BaseModel):
    decision: str = Field(pattern="^(Approved|Rejected)$")
    note: str = Field(default="", max_length=1000)


class PolicyOut(BaseModel):
    id: int
    policy_number: str
    customer_id: int
    customer_name: str
    product_name: str
    status: str
    premium: float
    coverage_amount: float


class WorkflowOut(BaseModel):
    id: int
    requirement: str
    status: str
    current_phase: str
    created_at: str
    executions: list[dict]
    approval: dict | None
