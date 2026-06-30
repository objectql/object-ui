/* Auto-extracted from examples/app-showcase react scenario pages — verification harness only. */

export const triageSource = `
function Page() {
  const adapter = useAdapter();
  const [tab, setTab] = React.useState('all');
  const [sel, setSel] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [counts, setCounts] = React.useState({ all: 0, new: 0, contacted: 0, closed: 0 });

  const refresh = React.useCallback(async () => {
    if (!adapter) return;
    const res = await adapter.find('showcase_inquiry', { top: 500 });
    const rows = Array.isArray(res) ? res : (res && res.records) || [];
    setCounts({
      all: rows.length,
      new: rows.filter((r) => r.status === 'new').length,
      contacted: rows.filter((r) => r.status === 'contacted').length,
      closed: rows.filter((r) => r.status === 'closed').length,
    });
  }, [adapter]);
  React.useEffect(() => { refresh(); }, [refresh, reload]);

  const setStatus = async (status) => {
    if (!adapter || !sel) return;
    await adapter.update('showcase_inquiry', sel.id, { status });
    setSel(null);
    setReload((k) => k + 1);
  };

  const TABS = [['all', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']];
  const filters = tab === 'all' ? undefined : ['status', '=', tab];
  const STATUS_COLOR = { new: 'bg-blue-100 text-blue-700', contacted: 'bg-amber-100 text-amber-700', closed: 'bg-emerald-100 text-emerald-700' };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inquiry Triage</h1>
        <p className="mt-1 text-sm text-slate-500">A support queue over <code>showcase_inquiry</code> — tabs filter a real <code>&lt;ListView&gt;</code>; one click moves an inquiry's status.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSel(null); }}
            className={'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ' + (tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
            {label}
            <span className={'rounded-full px-2 py-0.5 text-xs ' + (tab === k ? 'bg-white/20' : 'bg-white text-slate-500')}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <section className="col-span-3 rounded-xl border border-slate-200 bg-white p-2">
          <ListView key={tab + ':' + reload} objectName="showcase_inquiry"
            fields={['name', 'company', 'email', 'status']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => setSel(r)} />
        </section>
        <section className="col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          {sel ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{sel.name}</h2>
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + (STATUS_COLOR[sel.status] || 'bg-slate-100 text-slate-600')}>{sel.status}</span>
                </div>
                <p className="text-sm text-slate-500">{sel.company} · {sel.email}</p>
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{sel.message || 'No message.'}</p>
              <div className="flex gap-2">
                <button onClick={() => setStatus('contacted')} disabled={sel.status === 'contacted'}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">Mark Contacted</button>
                <button onClick={() => setStatus('closed')} disabled={sel.status === 'closed'}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Close</button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-slate-400">
              <div className="text-4xl">📥</div>
              <p className="mt-2 text-sm">Select an inquiry to triage.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`;

export const cockpitSource = `
function Page() {
  const adapter = useAdapter();
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [related, setRelated] = React.useState({ projects: 0, invoices: 0, openInvoices: 0 });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!adapter || !sel) { setRelated({ projects: 0, invoices: 0, openInvoices: 0 }); return; }
      const pr = await adapter.find('showcase_project', { $filter: ['account', '=', sel.id], top: 500 });
      const iv = await adapter.find('showcase_invoice', { $filter: ['account', '=', sel.id], top: 500 });
      const projects = Array.isArray(pr) ? pr : (pr && pr.records) || [];
      const invoices = Array.isArray(iv) ? iv : (iv && iv.records) || [];
      if (alive) setRelated({ projects: projects.length, invoices: invoices.length, openInvoices: invoices.filter((r) => r.status !== 'paid' && r.status !== 'void').length });
    })();
    return () => { alive = false; };
  }, [adapter, sel, reload]);

  const filters = q.trim() ? ['name', 'contains', q.trim()] : undefined;
  const Stat = ({ label, value, accent }) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'mt-1 text-2xl font-bold ' + (accent || 'text-slate-900')}>{value}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Cockpit</h1>
          <p className="mt-1 text-sm text-slate-500">Customer-360 over <code>showcase_account</code> — search, edit, and roll up related projects &amp; invoices.</p>
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }}
          placeholder="Search accounts…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </header>

      <div className="grid grid-cols-5 gap-6">
        <section className="col-span-3 rounded-xl border border-slate-200 bg-white p-2">
          <ListView key={q + ':' + reload} objectName="showcase_account"
            fields={['name', 'industry', 'status', 'annual_revenue']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => setSel(r)} />
        </section>
        <section className="col-span-2 space-y-4">
          {sel ? (
            <React.Fragment>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Projects" value={related.projects} />
                <Stat label="Invoices" value={related.invoices} />
                <Stat label="Open AR" value={related.openInvoices} accent="text-amber-600" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <ObjectForm key={sel.id + ':' + reload} objectName="showcase_account" mode="edit"
                  recordId={sel.id} onSuccess={() => { setSel(null); setReload((k) => k + 1); }}
                  onCancel={() => setSel(null)} />
              </div>
            </React.Fragment>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center text-slate-400">
              <div className="text-4xl">🛰️</div>
              <p className="mt-2 text-sm">Search and select an account.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`;

export const invoiceSource = `
function Page() {
  const adapter = useAdapter();
  const [status, setStatus] = React.useState('all');
  const [sel, setSel] = React.useState(null);
  const [mode, setMode] = React.useState('edit');
  const [reload, setReload] = React.useState(0);
  const [kpi, setKpi] = React.useState({ count: 0, draft: 0, sent: 0, paid: 0 });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!adapter) return;
      const res = await adapter.find('showcase_invoice', { top: 500 });
      const rows = Array.isArray(res) ? res : (res && res.records) || [];
      if (alive) setKpi({
        count: rows.length,
        draft: rows.filter((r) => r.status === 'draft').length,
        sent: rows.filter((r) => r.status === 'sent').length,
        paid: rows.filter((r) => r.status === 'paid').length,
      });
    })();
    return () => { alive = false; };
  }, [adapter, reload]);

  const afterWrite = () => { setSel(null); setMode('edit'); setReload((k) => k + 1); };
  const markPaid = async () => { if (!adapter || !sel) return; await adapter.update('showcase_invoice', sel.id, { status: 'paid' }); afterWrite(); };
  const openNew = () => { setSel(null); setMode('create'); };

  const FILTERS = [['all', 'All'], ['draft', 'Draft'], ['sent', 'Sent'], ['paid', 'Paid'], ['void', 'Void']];
  const filters = status === 'all' ? undefined : ['status', '=', status];
  const editing = mode === 'create' || sel;
  const Kpi = ({ label, value, accent }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'mt-1 text-3xl font-bold ' + (accent || 'text-slate-900')}>{value}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoice Console</h1>
          <p className="mt-1 text-sm text-slate-500">Accounts receivable over <code>showcase_invoice</code> — aggregate, filter, edit, and collect.</p>
        </div>
        <button onClick={openNew} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">+ New invoice</button>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Total" value={kpi.count} />
        <Kpi label="Draft" value={kpi.draft} accent="text-slate-500" />
        <Kpi label="Sent" value={kpi.sent} accent="text-blue-600" />
        <Kpi label="Paid" value={kpi.paid} accent="text-emerald-600" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={'rounded-full px-3.5 py-1 text-sm font-semibold ' + (status === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{label}</button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <section className="col-span-3 rounded-xl border border-slate-200 bg-white p-2">
          <ListView key={status + ':' + reload} objectName="showcase_invoice"
            fields={['name', 'account', 'status', 'total']} filters={filters}
            navigation={{ mode: 'none' }} onRowClick={(r) => { setSel(r); setMode('edit'); }} />
        </section>
        <section className="col-span-2 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          {editing ? (
            <React.Fragment>
              <ObjectForm key={(mode === 'create' ? 'new' : sel && sel.id) + ':' + reload}
                objectName="showcase_invoice" mode={mode}
                recordId={mode === 'edit' && sel ? sel.id : undefined}
                onSuccess={afterWrite} onCancel={() => setSel(null)} />
              {mode === 'edit' && sel && sel.status !== 'paid' ? (
                <button onClick={markPaid} className="w-full rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">✓ Mark Paid</button>
              ) : null}
            </React.Fragment>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-slate-400">
              <div className="text-4xl">🧾</div>
              <p className="mt-2 text-sm">Select an invoice, or create one.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}`;

export const taskdeskSource = `
function Page() {
  const adapter = useAdapter();
  const [editId, setEditId] = React.useState(null);   // drawer (edit existing)
  const [creating, setCreating] = React.useState(false); // modal (create new)
  const [reload, setReload] = React.useState(0);

  const closeAll = () => { setEditId(null); setCreating(false); };
  const afterWrite = () => { closeAll(); setReload((k) => k + 1); };

  // Close overlays on Escape — the kind of detail a real app needs.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeAll(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Task Desk</h1>
          <p className="mt-1 text-sm text-slate-500">Click a task to edit in a <strong>drawer</strong>; create one in a <strong>modal</strong> — both wrap the real <code>&lt;ObjectForm&gt;</code>.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">+ New task</button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <ListView key={reload} objectName="showcase_task"
          fields={['title', 'assignee', 'status', 'priority']}
          navigation={{ mode: 'none' }} onRowClick={(r) => setEditId(r.id)} />
      </div>

      {/* Drawer — edit an existing task */}
      {editId ? (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/30" onClick={closeAll} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Edit task</h2>
              <button onClick={closeAll} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ObjectForm key={'edit:' + editId + ':' + reload} objectName="showcase_task" mode="edit"
                recordId={editId} onSuccess={afterWrite} onCancel={closeAll} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal — create a new task */}
      {creating ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeAll} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">New task</h2>
              <button onClick={closeAll} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">✕</button>
            </div>
            <ObjectForm key={'new:' + reload} objectName="showcase_task" mode="create"
              onSuccess={afterWrite} onCancel={closeAll} />
          </div>
        </div>
      ) : null}
    </div>
  );
}`;
