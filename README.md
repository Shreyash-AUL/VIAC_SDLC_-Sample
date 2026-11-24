# VIAC Policy Administration Demo

A runnable synthetic-data starter for life and annuity policy administration and a LangGraph-based, multi-agent SDLC workflow. It is intended for local evaluation, not insurance production or regulatory use.

## Architecture

- **Frontend:** React 18, TypeScript, Vite (`frontend/`).
- **API:** FastAPI and Pydantic (`backend/app/`), with OpenAPI documentation at `/docs`.
- **Persistence:** SQLAlchemy models support PostgreSQL and SQLite. Tables are initialized from the ORM metadata at startup; seed records are synthetic.
- **Workflow:** LangGraph sequences nine tasks across seven specialist roles. Agent results in this demo are deterministic mock artifacts; no LLM is called.
- **Deployment:** Docker Compose starts PostgreSQL, the API, and the dashboard. GitHub Actions runs backend tests and the frontend build.

The database model includes customers, products, policies, claims, payments, workflow runs, agent executions, approvals, and audit events. The UI provides overview, customer, policy, claim, and orchestration views.

## Run locally

### API

From the repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DATABASE_URL = "sqlite:///./pas.db"
$env:DEMO_MODE = "true"
$env:DEMO_TOKEN = "local-demo-token"
python -m uvicorn backend.app.main:app --reload
```

The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`. On first startup, it creates the schema and inserts synthetic demo customers, products, policies, claims, and payments.

### Dashboard

In another terminal:

```powershell
Set-Location frontend
npm install
$env:VITE_API_URL = "http://localhost:8000"
$env:VITE_DEMO_TOKEN = "local-demo-token"
npm run dev
```

Open `http://localhost:5173`. Mutating API requests use the local demo bearer token. This token is only a development convenience, not production authentication.

### Docker Compose

With Docker Desktop running, from the repository root:

```powershell
docker compose up --build
```

Open the dashboard at `http://localhost:8080`, API docs at `http://localhost:8000/docs`. Compose uses development-only database credentials and a demo token. Do not expose this configuration publicly.

## Demonstrated workflows

1. Register a synthetic customer.
2. Create a draft policy using a configured demo product.
3. Issue the policy after the required business checks.
4. Record a payment or register a claim against an active policy.
5. Submit a business requirement to the SDLC orchestrator.
6. Review artifacts from Business Analyst, Reviewer, Architecture, Tech Lead, Developer, Tester, and Release roles.
7. Approve or reject the prepared release package. Approval records a decision only; no deployment endpoint or deployment action is implemented.

Mutating endpoints require a bearer token in demo mode. API actions are recorded in the audit log. See `/docs` for request and response schemas.

## API outline

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness check |
| `GET /api/dashboard` | Portfolio and workflow metrics |
| `GET, POST /api/customers` | List and create customers |
| `GET /api/products` | Active product catalog |
| `GET, POST /api/policies` | List policies and create drafts |
| `POST /api/policies/{id}/issue` | Issue a draft policy |
| `GET, POST /api/claims` | List and submit claims |
| `GET, POST /api/payments` | List and record simulated payments |
| `GET, POST /api/workflows` | List or execute SDLC workflows |
| `GET /api/workflows/{id}` | Read workflow and execution history |
| `POST /api/workflows/{id}/approval` | Record an explicit human approval or rejection |

## Implemented vs. simulated

**Implemented:** FastAPI API and OpenAPI schema; ORM-backed customer/product/policy/claim/payment data; policy draft-to-active transition; validation of claim/payment policy status; audit-event persistence; synthetic dashboard data; LangGraph orchestration and execution history; a human approval/rejection gate; React dashboard and forms; local Docker/CI scaffolding.

**Simulated or incomplete:** Agent artifacts are fixed templates, not LLM output. Payments are ledger entries only, not collections or reconciliation. Claims are registered but not adjudicated or settled. Product eligibility and premium calculation use simple catalog values. Beneficiaries, documents, policy amendments/renewals/cancellations/reinstatements, annuity transactions, report exports, OIDC/SSO, fine-grained RBAC, production secrets integration, encryption/key management, database migrations, deployment execution/rollback, and Azure/monitoring integrations are not implemented.

## Production and compliance boundary

The built-in bearer token is a local demo mechanism. Setting `DEMO_MODE=false` deliberately disables protected mutations with a configuration error until an OIDC integration is implemented; it does not create production authentication. Before deployment, add and verify an identity provider, role/permission enforcement, managed secrets, TLS and encryption-at-rest controls, migrations/backups, monitoring, rate limits, operational runbooks, independent security testing, and approved deployment automation.

Determine applicable insurance, privacy, security, retention, and AI governance requirements with qualified compliance/legal stakeholders for the target jurisdiction before using real data or production policies. Demo records are synthetic; do not enter sensitive personal or insurance information.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./pas.db` | SQLAlchemy URL; use `postgresql+psycopg://...` for PostgreSQL |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `DEMO_MODE` | `true` | Keeps demo auth enabled; non-demo auth is not implemented |
| `DEMO_TOKEN` | `local-demo-token` | Development bearer token; replace for local use |
| `LLM_PROVIDER` | `mock` | Reserved provider setting; no provider adapter is currently called |
| `LLM_API_KEY` | unset | Reserved setting; do not add real keys to source control |
| `VITE_API_URL` | `http://localhost:8000` | API URL embedded in the frontend build |
| `VITE_DEMO_TOKEN` | `local-demo-token` | Demo bearer token embedded in the local UI build |

## Tests

```powershell
python -m unittest discover -s tests -v
```

The tests cover synthetic seeding, policy issue and claim registration, authorization on mutations, and the multi-agent approval gate.
