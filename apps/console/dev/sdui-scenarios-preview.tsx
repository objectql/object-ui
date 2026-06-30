/* Verification harness for the kind:'react' business-scenario showcase pages
 * (examples/app-showcase: inquiry-triage / account-cockpit / invoice-console).
 * Each page source is rendered through the REAL PageRenderer; a small in-memory
 * multi-object adapter stands in for the backend so the real plugins (ListView,
 * ObjectForm) mount and the interactions are genuinely exercised. Dev-only. */
import '../src/index.css';
import '@object-ui/components';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-view';
import '@object-ui/plugin-list';
import '@object-ui/plugin-form';
import '@object-ui/plugin-detail';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SchemaRenderer, SchemaRendererProvider, AdapterCtx } from '@object-ui/react';
import { I18nProvider } from '@object-ui/i18n';
import { triageSource, cockpitSource, invoiceSource, taskdeskSource } from './scenario-sources';

// ---------------------------------------------------------------------------
// In-memory multi-object adapter (just enough for ListView + ObjectForm)
// ---------------------------------------------------------------------------
const SELECT = (opts: [string, string][]) => ({ type: 'select', options: opts.map(([value, label]) => ({ value, label })) });
const SCHEMAS: Record<string, any> = {
  showcase_inquiry: { name: 'showcase_inquiry', label: 'Inquiry', fields: {
    name: { type: 'text', label: 'Name', required: true }, email: { type: 'text', label: 'Email' },
    company: { type: 'text', label: 'Company' }, message: { type: 'text', label: 'Message' },
    status: { ...SELECT([['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']]), label: 'Status' },
  } },
  showcase_account: { name: 'showcase_account', label: 'Account', fields: {
    name: { type: 'text', label: 'Account Name', required: true },
    industry: { ...SELECT([['technology', 'Technology'], ['finance', 'Finance'], ['healthcare', 'Healthcare'], ['retail', 'Retail']]), label: 'Industry' },
    annual_revenue: { type: 'currency', label: 'Annual Revenue' },
    status: { ...SELECT([['prospect', 'Prospect'], ['active', 'Active'], ['churned', 'Churned']]), label: 'Lifecycle' },
    billing_email: { type: 'text', label: 'Billing Email' },
  } },
  showcase_invoice: { name: 'showcase_invoice', label: 'Invoice', fields: {
    name: { type: 'text', label: 'Invoice Number', required: true }, account: { type: 'text', label: 'Account' },
    owner: { type: 'text', label: 'Owner' },
    status: { ...SELECT([['draft', 'Draft'], ['sent', 'Sent'], ['paid', 'Paid'], ['void', 'Void']]), label: 'Status' },
    total: { type: 'currency', label: 'Total' },
  } },
  showcase_project: { name: 'showcase_project', label: 'Project', fields: {
    name: { type: 'text', label: 'Project Name', required: true }, account: { type: 'text', label: 'Account' },
    status: { ...SELECT([['planned', 'Planned'], ['active', 'Active'], ['on_hold', 'On Hold'], ['completed', 'Completed']]), label: 'Status' },
    health: { ...SELECT([['green', 'Green'], ['yellow', 'Yellow'], ['red', 'Red']]), label: 'Health' },
    budget: { type: 'currency', label: 'Budget' }, owner: { type: 'text', label: 'Owner' },
  } },
  showcase_task: { name: 'showcase_task', label: 'Task', fields: {
    title: { type: 'text', label: 'Title', required: true }, assignee: { type: 'text', label: 'Assignee' },
    status: { ...SELECT([['backlog', 'Backlog'], ['todo', 'To Do'], ['in_progress', 'In Progress'], ['in_review', 'In Review'], ['done', 'Done']]), label: 'Status' },
    priority: { ...SELECT([['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']]), label: 'Priority' },
    estimate_hours: { type: 'number', label: 'Estimate (h)' },
  } },
};
const store: Record<string, any[]> = {
  showcase_account: [
    { id: 'a1', name: 'Acme Corp', industry: 'technology', status: 'active', annual_revenue: 5200000, billing_email: 'ap@acme.com' },
    { id: 'a2', name: 'Globex', industry: 'finance', status: 'prospect', annual_revenue: 1800000, billing_email: 'billing@globex.com' },
    { id: 'a3', name: 'Initech', industry: 'healthcare', status: 'active', annual_revenue: 940000, billing_email: 'ar@initech.com' },
    { id: 'a4', name: 'Umbrella', industry: 'retail', status: 'churned', annual_revenue: 320000, billing_email: 'pay@umbrella.com' },
  ],
  showcase_inquiry: [
    { id: 'q1', name: 'Maria Soto', email: 'maria@northwind.com', company: 'Northwind', message: 'Interested in the enterprise plan and SSO.', status: 'new' },
    { id: 'q2', name: 'Dev Patel', email: 'dev@fabrikam.io', company: 'Fabrikam', message: 'Can we get a demo next week?', status: 'new' },
    { id: 'q3', name: 'Lena Fischer', email: 'lena@contoso.de', company: 'Contoso', message: 'Following up on pricing.', status: 'contacted' },
    { id: 'q4', name: 'Omar Said', email: 'omar@tailspin.co', company: 'Tailspin', message: 'Resolved — signed up.', status: 'closed' },
    { id: 'q5', name: 'Yuki Tan', email: 'yuki@adventure.works', company: 'Adventure Works', message: 'Question about API limits.', status: 'new' },
  ],
  showcase_invoice: [
    { id: 'i1', name: 'INV-1001', account: 'a1', owner: 'Dana Lee', status: 'paid', total: 42000 },
    { id: 'i2', name: 'INV-1002', account: 'a1', owner: 'Dana Lee', status: 'sent', total: 18500 },
    { id: 'i3', name: 'INV-1003', account: 'a2', owner: 'Sam Ortiz', status: 'draft', total: 7600 },
    { id: 'i4', name: 'INV-1004', account: 'a3', owner: 'Chen Wu', status: 'sent', total: 23100 },
    { id: 'i5', name: 'INV-1005', account: 'a1', owner: 'Dana Lee', status: 'draft', total: 9900 },
  ],
  showcase_project: [
    { id: 'p1', name: 'Apollo Migration', account: 'a1', status: 'active', health: 'green', budget: 120000, owner: 'Dana Lee' },
    { id: 'p2', name: 'Billing Revamp', account: 'a1', status: 'planned', health: 'yellow', budget: 80000, owner: 'Sam Ortiz' },
    { id: 'p3', name: 'Mobile App v2', account: 'a3', status: 'active', health: 'red', budget: 210000, owner: 'Priya N.' },
  ],
  showcase_task: [
    { id: 't1', title: 'Wire up SSO', assignee: 'Dana Lee', status: 'in_progress', priority: 'high', estimate_hours: 8 },
    { id: 't2', title: 'Migrate billing schema', assignee: 'Sam Ortiz', status: 'todo', priority: 'urgent', estimate_hours: 13 },
    { id: 't3', title: 'Polish onboarding', assignee: 'Priya N.', status: 'backlog', priority: 'medium', estimate_hours: 5 },
  ],
};
let nextId = 100;

function matchFilter(row: any, f: any): boolean {
  if (!f) return true;
  if (f[0] === 'and') return f.slice(1).every((c: any) => matchFilter(row, c));
  if (f[0] === 'or') return f.slice(1).some((c: any) => matchFilter(row, c));
  const [field, op, value] = f;
  const v = row[field];
  if (op === '=') return String(v) === String(value);
  if (op === '!=') return String(v) !== String(value);
  if (op === 'contains') return String(v ?? '').toLowerCase().includes(String(value).toLowerCase());
  return true;
}
const adapter: any = {
  find: async (obj: string, params: any) => (store[obj] || []).filter((r) => matchFilter(r, params && params.$filter)),
  findOne: async (obj: string, id: any) => (store[obj] || []).find((r) => String(r.id) === String(id)) || null,
  create: async (obj: string, data: any) => { const rec = { id: String(nextId++), ...data }; (store[obj] = store[obj] || []).push(rec); return rec; },
  update: async (obj: string, id: any, data: any) => { const i = (store[obj] || []).findIndex((r) => String(r.id) === String(id)); if (i >= 0) store[obj][i] = { ...store[obj][i], ...data }; return store[obj][i]; },
  getObjectSchema: async (obj: string) => SCHEMAS[obj] || { name: obj, fields: {} },
};

// ---------------------------------------------------------------------------
const SCENARIOS: { key: string; label: string; source: string }[] = [
  { key: 'triage', label: 'Inquiry Triage', source: triageSource },
  { key: 'cockpit', label: 'Account Cockpit', source: cockpitSource },
  { key: 'invoice', label: 'Invoice Console', source: invoiceSource },
  { key: 'taskdesk', label: 'Task Desk', source: taskdeskSource },
];

function Harness() {
  const [active, setActive] = React.useState('triage');
  const sc = SCENARIOS.find((s) => s.key === active)!;
  const page = { type: 'home', kind: 'react', name: 'scenario_' + active, label: sc.label, source: sc.source };
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-10 flex gap-2 border-b border-slate-200 bg-white px-6 py-3">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-slate-400">Scenario</span>
        {SCENARIOS.map((s) => (
          <button key={s.key} data-scenario={s.key} onClick={() => setActive(s.key)}
            className={'rounded-lg px-3 py-1.5 text-sm font-semibold ' + (active === s.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{s.label}</button>
        ))}
      </div>
      <SchemaRenderer key={active} schema={page as any} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AdapterCtx.Provider value={adapter}>
        <SchemaRendererProvider dataSource={adapter}>
          <Harness />
        </SchemaRendererProvider>
      </AdapterCtx.Provider>
    </I18nProvider>
  </React.StrictMode>,
);
