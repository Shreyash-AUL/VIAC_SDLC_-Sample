import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, Bell, BriefcaseBusiness,
  Check, ChevronDown, CircleAlert, ClipboardCheck, Clock3, FileText, HeartPulse,
  LayoutDashboard, Menu, Plus, Search, ShieldCheck, Users, WalletCards, X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN = import.meta.env.VITE_DEMO_TOKEN ?? "local-demo-token";

type Customer = { id: number; name: string; email: string; phone: string };
type Product = { id: number; code: string; name: string; category: string; base_premium: number; coverage_amount: number };
type Policy = { id: number; policy_number: string; customer_id: number; customer_name: string; product_name: string; status: string; premium: number; coverage_amount: number };
type Claim = { id: number; claim_number: string; policy_number: string; amount: number; status: string; description: string };
type Execution = { id: number; agent_name: string; task: string; status: string; progress: number; artifact: string; issue: string; duration_ms: number };
type Approval = { status: string; approver: string; note: string; decided_at: string | null };
type Workflow = { id: number; requirement: string; status: string; current_phase: string; created_at: string; executions: Execution[]; approval: Approval | null };
type Dashboard = { customers: number; active_policies: number; pending_policies: number; open_claims: number; premium_collected: number; pending_approvals: number; latest_workflow: Workflow | null; demo_mode: boolean };
type Section = "Overview" | "Policies" | "Customers" | "Claims" | "AI Orchestration";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.method) {
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${TOKEN}`);
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

function App() {
  const [section, setSection] = useState<Section>("Overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"customer" | "policy" | "claim" | "workflow" | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [stats, customerRows, productRows, policyRows, claimRows, workflowRows] = await Promise.all([
        request<Dashboard>("/api/dashboard"),
        request<Customer[]>("/api/customers"),
        request<Product[]>("/api/products"),
        request<Policy[]>("/api/policies"),
        request<Claim[]>("/api/claims"),
        request<Workflow[]>("/api/workflows"),
      ]);
      setDashboard(stats);
      setCustomers(customerRows);
      setProducts(productRows);
      setPolicies(policyRows);
      setClaims(claimRows);
      setWorkflows(workflowRows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the administration dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(path: string, method: string, payload: unknown, success: string) {
    try {
      await request(path, { method, body: JSON.stringify(payload) });
      setModal(null);
      setNotice(success);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be completed.");
    }
  }

  async function issuePolicy(policyId: number) {
    await submit(`/api/policies/${policyId}/issue`, "POST", {}, "Policy issued successfully.");
  }

  async function decide(workflowId: number, decision: "Approved" | "Rejected") {
    const note = decision === "Approved" ? "Human approval recorded from the demo dashboard." : "Rejected from the demo dashboard.";
    await submit(`/api/workflows/${workflowId}/approval`, "POST", { decision, note }, `Workflow ${decision.toLowerCase()}. No deployment was performed.`);
  }

  const links: { label: Section; icon: typeof LayoutDashboard }[] = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Policies", icon: FileText },
    { label: "Customers", icon: Users },
    { label: "Claims", icon: HeartPulse },
    { label: "AI Orchestration", icon: Activity },
  ];

  const filteredPolicies = policies.filter((row) => `${row.policy_number} ${row.customer_name} ${row.product_name}`.toLowerCase().includes(search.toLowerCase()));
  const filteredCustomers = customers.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark">V</div><div><strong>VIAC</strong><span>POLICY ADMIN</span></div><button className="icon-btn mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{links.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMobileMenu(false); }}><Icon size={18} /><span>{label}</span>{label === "AI Orchestration" && dashboard?.pending_approvals ? <b className="nav-count">{dashboard.pending_approvals}</b> : null}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="support-card"><div className="support-icon"><ShieldCheck size={17} /></div><strong>Secure workspace</strong><p>Synthetic records only. Use approved identity and data services before production.</p></div>
          <div className="profile"><div className="avatar">SA</div><div><strong>Sample Admin</strong><span>Demo operator</span></div><ChevronDown size={16} className="profile-chevron" /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{section}</strong></div>
          <div className="topbar-right">
            <div className="environment-pill"><span /> DEMO ENVIRONMENT</div>
            <button className="icon-btn notification-btn" aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="top-avatar">SA</div>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="alert error-alert"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="alert success-alert"><Check size={18} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16} /></button></div>}
          {dashboard?.demo_mode && <div className="demo-banner"><ShieldCheck size={16} /><span><strong>Demo mode</strong> &nbsp;Synthetic data only. Payments, AI agents, authentication and release operations are simulated.</span></div>}
          {loading ? <div className="loading-panel">Loading policy administration workspace…</div> : (
            <>
              {section === "Overview" && <Overview dashboard={dashboard} policies={policies} claims={claims} workflows={workflows} onNavigate={setSection} onRun={() => setModal("workflow")} />}
              {section === "Policies" && <Policies rows={filteredPolicies} query={search} onSearch={setSearch} onCreate={() => setModal("policy")} onIssue={issuePolicy} />}
              {section === "Customers" && <Customers rows={filteredCustomers} query={search} onSearch={setSearch} onCreate={() => setModal("customer")} />}
              {section === "Claims" && <Claims rows={claims} policies={policies} onCreate={() => setModal("claim")} />}
              {section === "AI Orchestration" && <Orchestration workflows={workflows} onRun={() => setModal("workflow")} onDecision={decide} />}
            </>
          )}
        </div>
      </main>

      {modal && <Modal title={{ customer: "Add customer", policy: "Create policy", claim: "Register claim", workflow: "Start SDLC workflow" }[modal]} onClose={() => setModal(null)}>
        {modal === "customer" && <CustomerForm onSubmit={(payload) => submit("/api/customers", "POST", payload, "Customer added.")} />}
        {modal === "policy" && <PolicyForm customers={customers} products={products} onSubmit={(payload) => submit("/api/policies", "POST", payload, "Draft policy created.")} />}
        {modal === "claim" && <ClaimForm policies={policies} onSubmit={(payload) => submit("/api/claims", "POST", payload, "Claim submitted for review.")} />}
        {modal === "workflow" && <WorkflowForm onSubmit={(payload) => submit("/api/workflows", "POST", payload, "Workflow completed. Approval is required before deployment.")} />}
      </Modal>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ dashboard, policies, claims, workflows, onNavigate, onRun }: { dashboard: Dashboard | null; policies: Policy[]; claims: Claim[]; workflows: Workflow[]; onNavigate: (section: Section) => void; onRun: () => void }) {
  const cards = [
    { label: "Active policies", value: dashboard?.active_policies ?? 0, icon: BriefcaseBusiness, color: "blue", change: `${dashboard?.pending_policies ?? 0} pending issue` },
    { label: "Premium recorded", value: money(dashboard?.premium_collected ?? 0), icon: WalletCards, color: "green", change: "Mock payment ledger" },
    { label: "Customers", value: dashboard?.customers ?? 0, icon: Users, color: "purple", change: "Synthetic profiles" },
    { label: "Open claims", value: dashboard?.open_claims ?? 0, icon: HeartPulse, color: "orange", change: "Review required" },
  ];
  return <>
    <PageHeading eyebrow="POLICY ADMINISTRATION" title="Good morning, Sam" description="Here’s what’s happening across your insurance portfolio today." action={<button className="button primary-button" onClick={onRun}><Plus size={16} /> New AI workflow</button>} />
    <div className="metric-grid">{cards.map(({ label, value, icon: Icon, color, change }) => <article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><div className={`metric-icon ${color}`}><Icon size={18} /></div></div><strong className="metric-value">{value}</strong><div className="metric-foot"><span className="metric-dot" />{change}</div></article>)}</div>
    <div className="content-grid">
      <section className="panel portfolio-panel"><div className="panel-heading"><div><h2>Portfolio snapshot</h2><p>Policy status overview</p></div><button className="text-button" onClick={() => onNavigate("Policies")}>View policies <ArrowUpRight size={14} /></button></div>
        <div className="portfolio-total"><span>Total coverage in force</span><strong>{money(policies.filter((p) => p.status === "Active").reduce((sum, p) => sum + p.coverage_amount, 0))}</strong>        <span className="trend-positive"><ShieldCheck size={14} /> <span className="muted">Synthetic demo portfolio</span></span></div>
        <div className="chart" aria-label="Illustrative six-month policy activity chart"><div className="chart-grid"><span>$600k</span><span>$400k</span><span>$200k</span><span>$0</span></div><div className="chart-bars">{[38, 48, 42, 63, 54, 74, 67, 87, 72, 92, 82, 100].map((height, index) => <div key={index} className={`chart-bar ${index > 8 ? "chart-bar-current" : ""}`} style={{ height: `${height}%` }} />)}</div></div>
        <div className="chart-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
      </section>
      <section className="panel workflow-panel"><div className="panel-heading"><div><h2>AI workflow</h2><p>Multi-agent delivery pipeline</p></div><span className="live-indicator"><i /> LIVE</span></div>
        {workflows[0] ? <><div className="workflow-current"><div className="workflow-symbol"><Activity size={17} /></div><div><strong>Workflow #{workflows[0].id}</strong><span>{workflows[0].current_phase}</span></div><span className="status-tag status-completed">{workflows[0].status}</span></div><AgentMiniSteps workflow={workflows[0]} /><div className="approval-line"><span><Clock3 size={15} /> Human deployment approval</span><span className={`status-tag ${workflows[0].approval?.status === "Pending" ? "status-pending" : "status-approved"}`}>{workflows[0].approval?.status ?? "N/A"}</span></div></> : <div className="empty-workflow"><div className="empty-icon"><Activity size={22} /></div><strong>Ready to orchestrate</strong><p>Start a requirement and watch all seven specialist agents coordinate their work.</p><button className="button outline-button" onClick={onRun}>Start first workflow <ArrowUpRight size={15} /></button></div>}
        <button className="panel-footer-link" onClick={() => onNavigate("AI Orchestration")}>Open orchestration center <ArrowUpRight size={14} /></button>
      </section>
    </div>
    <div className="bottom-grid">
      <section className="panel table-panel"><div className="panel-heading"><div><h2>Recent policies</h2><p>Latest policy activity</p></div><button className="text-button" onClick={() => onNavigate("Policies")}>View all <ArrowUpRight size={14} /></button></div><PolicyTable rows={policies.slice(0, 4)} /></section>
      <section className="panel claims-panel"><div className="panel-heading"><div><h2>Claims to review</h2><p>Claims needing attention</p></div><button className="text-button" onClick={() => onNavigate("Claims")}>View all <ArrowUpRight size={14} /></button></div>{claims.slice(0, 3).map((claim) => <div className="claim-row" key={claim.id}><div className="claim-icon"><HeartPulse size={16} /></div><div className="claim-info"><strong>{claim.claim_number}</strong><span>{claim.policy_number}</span></div><div className="claim-amount"><strong>{money(claim.amount)}</strong><span>{claim.status}</span></div></div>)}{claims.length === 0 && <div className="empty-note">No claims have been registered.</div>}</section>
    </div>
  </>;
}

function AgentMiniSteps({ workflow }: { workflow: Workflow }) {
  const unique = workflow.executions.filter((item, index, list) => list.findIndex((other) => other.agent_name === item.agent_name) === index);
  return <div className="mini-steps">{unique.map((item, index) => <div className="mini-step" key={item.id}><span className={`step-node ${item.status === "Completed" ? "done" : ""}`}>{item.status === "Completed" ? <Check size={12} /> : index + 1}</span><span>{item.agent_name.replace(" Agent", "")}</span></div>)}</div>;
}

function Policies({ rows, query, onSearch, onCreate, onIssue }: { rows: Policy[]; query: string; onSearch: (q: string) => void; onCreate: () => void; onIssue: (id: number) => void }) {
  return <><PageHeading eyebrow="POLICY OPERATIONS" title="Policies" description="Manage policy issuance and keep your book of business up to date." action={<button className="button primary-button" onClick={onCreate}><Plus size={16} /> Create policy</button>} />
    <div className="toolbar"><SearchInput value={query} onChange={onSearch} placeholder="Search policies..." /><div className="toolbar-meta">{rows.length} policies</div></div>
    <section className="panel full-table"><PolicyTable rows={rows} onIssue={onIssue} showIssue /></section>
    <div className="info-strip"><CircleAlert size={17} /><span>New policies are created as drafts. Issue only after eligibility and underwriting checks have been completed.</span></div>
  </>;
}

function PolicyTable({ rows, onIssue, showIssue = false }: { rows: Policy[]; onIssue?: (id: number) => void; showIssue?: boolean }) {
  return <div className="table-scroll"><table><thead><tr><th>POLICY</th><th>POLICYHOLDER</th><th>PRODUCT</th><th>PREMIUM</th><th>STATUS</th>{showIssue && <th />}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong className="mono">{row.policy_number}</strong></td><td><span className="person-cell"><span className="small-avatar">{row.customer_name.split(" ").map((part) => part[0]).join("")}</span>{row.customer_name}</span></td><td>{row.product_name}</td><td>{money(row.premium)}<span className="table-sub"> / month</span></td><td><StatusTag status={row.status} /></td>{showIssue && <td>{row.status === "Draft" && <button className="small-action" onClick={() => onIssue?.(row.id)}>Issue <ArrowUpRight size={13} /></button>}</td>}</tr>)}</tbody></table>{rows.length === 0 && <div className="empty-note">No policies match your search.</div>}</div>;
}

function Customers({ rows, query, onSearch, onCreate }: { rows: Customer[]; query: string; onSearch: (q: string) => void; onCreate: () => void }) {
  return <><PageHeading eyebrow="CUSTOMER RELATIONSHIPS" title="Customers" description="View policyholders and maintain their contact profiles." action={<button className="button primary-button" onClick={onCreate}><Plus size={16} /> Add customer</button>} />
    <div className="toolbar"><SearchInput value={query} onChange={onSearch} placeholder="Search customers..." /><div className="toolbar-meta">{rows.length} customers</div></div>
    <section className="panel full-table"><div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>POLICYHOLDER ID</th></tr></thead><tbody>{rows.map((customer) => <tr key={customer.id}><td><span className="person-cell"><span className="small-avatar">{customer.name.split(" ").map((part) => part[0]).join("")}</span><strong>{customer.name}</strong></span></td><td>{customer.email}</td><td>{customer.phone || "—"}</td><td className="mono">CUS-{String(customer.id).padStart(5, "0")}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-note">No customers match your search.</div>}</div></section>
  </>;
}

function Claims({ rows, policies, onCreate }: { rows: Claim[]; policies: Policy[]; onCreate: () => void }) {
  return <><PageHeading eyebrow="CLAIMS OPERATIONS" title="Claims" description="Register claims and monitor their assessment status." action={<button className="button primary-button" onClick={onCreate}><Plus size={16} /> Register claim</button>} />
    <div className="metric-grid compact-grid"><article className="metric-card"><div className="metric-top"><span>Open claims</span><div className="metric-icon orange"><HeartPulse size={18} /></div></div><strong className="metric-value">{rows.filter((row) => row.status !== "Settled").length}</strong><div className="metric-foot">Requires claims review</div></article><article className="metric-card"><div className="metric-top"><span>Paid benefits</span><div className="metric-icon green"><BadgeCheck size={18} /></div></div><strong className="metric-value">{money(rows.filter((row) => row.status === "Settled").reduce((sum, row) => sum + row.amount, 0))}</strong><div className="metric-foot">Demo claim records</div></article><article className="metric-card"><div className="metric-top"><span>Eligible policies</span><div className="metric-icon blue"><FileText size={18} /></div></div><strong className="metric-value">{policies.filter((policy) => policy.status === "Active").length}</strong><div className="metric-foot">Active coverage only</div></article></div>
    <section className="panel full-table"><div className="panel-heading table-title"><div><h2>Claim register</h2><p>Submitted claims and assessment status</p></div></div><div className="table-scroll"><table><thead><tr><th>CLAIM</th><th>POLICY</th><th>DESCRIPTION</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="mono">{row.claim_number}</td><td className="mono">{row.policy_number}</td><td>{row.description}</td><td>{money(row.amount)}</td><td><StatusTag status={row.status} /></td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-note">No claims have been registered.</div>}</div></section>
  </>;
}

function Orchestration({ workflows, onRun, onDecision }: { workflows: Workflow[]; onRun: () => void; onDecision: (id: number, decision: "Approved" | "Rejected") => void }) {
  const active = workflows[0];
  return <><PageHeading eyebrow="AI DELIVERY OPERATIONS" title="AI Orchestration" description="Coordinate the seven specialist agents across your SDLC workflow." action={<button className="button primary-button" onClick={onRun}><Plus size={16} /> New requirement</button>} />
    <div className="orchestration-banner"><div className="orchestration-banner-icon"><Activity size={21} /></div><div><strong>Master Orchestrator</strong><p>Routes requirements through analysis, design, implementation, review and release preparation.</p></div><span className="status-tag status-completed">READY</span></div>
    {active ? <div className="workflow-detail">
      <section className="panel workflow-run-card"><div className="panel-heading"><div><div className="eyebrow">LATEST RUN · #{active.id}</div><h2>{active.current_phase}</h2><p>{active.requirement}</p></div><StatusTag status={active.status} /></div>
        <div className="agent-list">{active.executions.map((item, index) => <div className="agent-row" key={item.id}><div className={`agent-step-icon ${item.status === "Completed" ? "step-success" : ""}`}>{item.status === "Completed" ? <Check size={15} /> : index + 1}</div><div className="agent-main"><strong>{item.agent_name} Agent</strong><span>{item.task}</span>{item.artifact && <p>{item.artifact}</p>}</div><div className="agent-meta"><StatusTag status={item.status} /><span>{item.duration_ms} ms</span></div></div>)}</div>
      </section>
      <section className="panel approval-card"><div className="panel-heading"><div><div className="eyebrow">HUMAN IN THE LOOP</div><h2>Release approval</h2><p>Production deployment must be separately authorized.</p></div><div className="approval-shield"><ShieldCheck size={19} /></div></div>
        <div className="approval-status-box"><span className="approval-status-icon"><ClipboardCheck size={18} /></span><div><strong>{active.approval?.status === "Pending" ? "Approval required" : `Decision: ${active.approval?.status ?? "Not requested"}`}</strong><span>{active.approval?.status === "Pending" ? "All workflow checks are complete. Approve or reject this release package." : active.approval?.note || "No pending decision."}</span></div></div>
        {active.approval?.status === "Pending" ? <div className="approval-actions"><button className="button reject-button" onClick={() => onDecision(active.id, "Rejected")}><X size={15} /> Reject</button><button className="button approve-button" onClick={() => onDecision(active.id, "Approved")}><Check size={15} /> Approve package</button></div> : <div className="approval-history"><Clock3 size={15} /><span>{active.approval?.approver ? `Decision recorded by ${active.approval.approver}` : "No approval history yet"}{active.approval?.decided_at ? ` · ${new Date(active.approval.decided_at).toLocaleString()}` : ""}</span></div>}
        <div className="release-note"><CircleAlert size={15} /><span>Approval records readiness only. This demo does not deploy to any environment.</span></div>
      </section>
    </div> : <section className="panel empty-large"><div className="empty-icon"><Activity size={22} /></div><h2>No workflow runs yet</h2><p>Submit a business requirement to start the multi-agent SDLC process.</p><button className="button primary-button" onClick={onRun}><Plus size={16} /> Start workflow</button></section>}
    {workflows.length > 1 && <section className="panel history-panel"><div className="panel-heading"><div><h2>Previous runs</h2><p>Workflow execution history</p></div></div>{workflows.slice(1).map((workflow) => <div className="history-row" key={workflow.id}><span className="history-id">#{workflow.id}</span><span className="history-requirement">{workflow.requirement}</span><StatusTag status={workflow.approval?.status ?? workflow.status} /><span className="table-sub">{new Date(workflow.created_at).toLocaleDateString()}</span></div>)}</section>}
  </>;
}

function StatusTag({ status }: { status: string }) {
  const className = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`status-tag status-${className}`}>{status}</span>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-field"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><div className="eyebrow">POLICY ADMINISTRATION</div><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}</section></div>;
}

function CustomerForm({ onSubmit }: { onSubmit: (payload: unknown) => void }) {
  function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: data.get("name"), email: data.get("email"), phone: data.get("phone") }); }
  return <form className="form" onSubmit={handle}><label>Full name<input name="name" required minLength={2} placeholder="Alex Morgan" /></label><label>Email address<input name="email" type="email" required placeholder="alex@example.com" /></label><label>Phone number<input name="phone" placeholder="555-0100" /></label><div className="form-note"><ShieldCheck size={15} /> Use synthetic data for this demonstration.</div><button className="button primary-button form-submit" type="submit">Add customer <ArrowUpRight size={15} /></button></form>;
}

function PolicyForm({ customers, products, onSubmit }: { customers: Customer[]; products: Product[]; onSubmit: (payload: unknown) => void }) {
  function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ customer_id: Number(data.get("customer_id")), product_id: Number(data.get("product_id")) }); }
  return <form className="form" onSubmit={handle}><label>Policyholder<select name="customer_id" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Insurance product<select name="product_id" required defaultValue=""><option value="" disabled>Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.base_premium)}/mo</option>)}</select></label><div className="form-note"><CircleAlert size={15} /> New policy starts in Draft status and must be issued separately.</div><button className="button primary-button form-submit" type="submit">Create draft <ArrowUpRight size={15} /></button></form>;
}

function ClaimForm({ policies, onSubmit }: { policies: Policy[]; onSubmit: (payload: unknown) => void }) {
  const eligible = policies.filter((policy) => policy.status === "Active");
  function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ policy_id: Number(data.get("policy_id")), amount: Number(data.get("amount")), description: data.get("description") }); }
  return <form className="form" onSubmit={handle}><label>Active policy<select name="policy_id" required defaultValue=""><option value="" disabled>Select an active policy</option>{eligible.map((policy) => <option key={policy.id} value={policy.id}>{policy.policy_number} · {policy.customer_name}</option>)}</select></label><label>Claim amount<input name="amount" type="number" min="0.01" step="0.01" required placeholder="10000" /></label><label>Claim description<textarea name="description" required minLength={5} rows={3} placeholder="Provide a brief description" /></label><div className="form-note"><ArrowDownLeft size={15} /> Claim will be submitted for manual assessment.</div><button className="button primary-button form-submit" type="submit">Submit claim <ArrowUpRight size={15} /></button></form>;
}

function WorkflowForm({ onSubmit }: { onSubmit: (payload: unknown) => void }) {
  function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ requirement: data.get("requirement") }); }
  return <form className="form" onSubmit={handle}><label>Business requirement<textarea name="requirement" required minLength={10} maxLength={5000} rows={5} placeholder="Describe the product, workflow or change you want to deliver..." /></label><div className="workflow-preview"><div className="preview-icons"><span>BA</span><span>AR</span><span>DV</span><span>QA</span><span>RL</span></div><div><strong>7 specialist agents</strong><span>Requirements → architecture → code → tests → release</span></div></div><div className="form-note"><ShieldCheck size={15} /> Mock agent outputs only. Human approval is required; no deployment occurs.</div><button className="button primary-button form-submit" type="submit">Run workflow <ArrowUpRight size={15} /></button></form>;
}

export default App;
