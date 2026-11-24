from time import perf_counter
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from backend.app.agents import build_agent_steps
from backend.app.models import AgentExecution, Approval, WorkflowRun


class WorkflowState(TypedDict):
    workflow_id: int


def run_workflow(db: Session, requirement: str) -> WorkflowRun:
    run = WorkflowRun(requirement=requirement, status="In Progress")
    db.add(run)
    db.flush()
    try:
        steps = build_agent_steps(requirement)

        def execute_step(step):
            def node(_state: WorkflowState) -> dict:
                run.current_phase = step.phase
                started = perf_counter()
                execution = AgentExecution(
                    workflow_id=run.id,
                    agent_name=step.agent_name,
                    task=step.task,
                    status="In Progress",
                    progress=0,
                )
                db.add(execution)
                db.flush()
                execution.artifact = step.artifact
                execution.status = "Completed"
                execution.progress = 100
                execution.duration_ms = max(1, int((perf_counter() - started) * 1000))
                return {"workflow_id": run.id}

            return node

        graph = StateGraph(WorkflowState)
        node_names = []
        for index, step in enumerate(steps):
            node_name = f"agent_{index}"
            node_names.append(node_name)
            graph.add_node(node_name, execute_step(step))
        graph.add_edge(START, node_names[0])
        for current, following in zip(node_names, node_names[1:]):
            graph.add_edge(current, following)
        graph.add_edge(node_names[-1], END)
        graph.compile().invoke({"workflow_id": run.id})
        run.status = "Completed"
        run.current_phase = "Awaiting human approval"
        db.add(Approval(workflow_id=run.id, status="Pending"))
        db.commit()
        db.refresh(run)
        return run
    except Exception:
        db.rollback()
        raise
