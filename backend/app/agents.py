from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AgentStep:
    agent_name: str
    task: str
    artifact: str
    phase: str


def build_agent_steps(requirement: str) -> list[AgentStep]:
    """Produce transparent demo artifacts; no external LLM is called."""
    concise = " ".join(requirement.split())
    return [
        AgentStep("Business Analyst", "Analyze requirement and define acceptance criteria",
                 f"Functional requirement: {concise}\nAcceptance: scope is documented and traceable.", "Requirements"),
        AgentStep("Reviewer", "Validate business requirements",
                 "Requirements review: complete for a demonstration; jurisdictional review remains required.", "Requirements Review"),
        AgentStep("Architecture", "Create solution design",
                 "Design: REST API, relational data model, role boundaries, audit trail, and human approval gate.", "Architecture"),
        AgentStep("Tech Lead", "Review technical design",
                 "Technical review: design accepted for the demo workflow; production controls need environment validation.", "Design Approval"),
        AgentStep("Developer", "Implement application changes",
                 "Implementation artifact: API and UI workflow represented by this demo; external systems are mocked.", "Development"),
        AgentStep("Reviewer", "Review implementation quality",
                 "Code review: automated demo review completed; this is not a substitute for an independent security review.", "Code Review"),
        AgentStep("Tester", "Execute functional and regression tests",
                 "Test report: demo workflow checks passed; no production test evidence is implied.", "Testing"),
        AgentStep("Tech Lead", "Validate technical readiness",
                 "Readiness: demo artifacts are complete. Production deployment remains blocked pending authorized human approval.", "Readiness"),
        AgentStep("Release", "Prepare release and rollback artifacts",
                 "Release package: deployment readiness and rollback checklist prepared; no deployment was performed.", "Release"),
    ]


def workflow_summary(workflow: Any) -> dict:
    executions = [
        {
            "id": item.id,
            "agent_name": item.agent_name,
            "task": item.task,
            "status": item.status,
            "progress": item.progress,
            "artifact": item.artifact,
            "issue": item.issue,
            "duration_ms": item.duration_ms,
        }
        for item in workflow.executions
    ]
    approval = None
    if workflow.approval is not None:
        approval = {
            "status": workflow.approval.status,
            "approver": workflow.approval.approver,
            "note": workflow.approval.note,
            "decided_at": workflow.approval.decided_at.isoformat() if workflow.approval.decided_at else None,
        }
    return {
        "id": workflow.id,
        "requirement": workflow.requirement,
        "status": workflow.status,
        "current_phase": workflow.current_phase,
        "created_at": workflow.created_at.isoformat(),
        "executions": executions,
        "approval": approval,
    }
