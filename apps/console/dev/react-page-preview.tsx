/* ADR: kind:'react' PoC — inlined react-runner (transpile + scope-eval, no sandbox).
 * Renders REAL JSX with useState/map/onClick + an injected component + data. */
import '../src/index.css';
import { createRoot } from 'react-dom/client';
import { ReactRunner } from '@object-ui/react-runtime';

/* ---- a REAL kind:'react' page source (full JS) ---- */
const source = `
function Page() {
  const [count, setCount] = React.useState(0);
  const total = data.reduce((s, r) => s + r.amount, 0);
  const top = [...data].sort((a, b) => b.amount - a.amount)[0];
  return (
    <section className="min-h-screen space-y-5 bg-slate-50 p-10">
      <h1 className="text-3xl font-bold text-slate-900">Live React Page (kind:'react')</h1>
      <p className="text-slate-500">Real JSX — useState, map, onClick, arbitrary JS — running in the main React tree.</p>
      <button
        className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-indigo-700"
        onClick={() => setCount((c) => c + 1)}
      >
        Clicked {count} times
      </button>
      <div className="grid grid-cols-3 gap-4">
        {data.map((r, i) => (
          <div key={i} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">{r.name}</div>
            <div className="mt-1 text-2xl font-bold">{r.amount.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="text-lg font-medium">Total {total.toLocaleString()} · top {top.name}</div>
      <ObjectGrid object="account" rows={data.length} />
    </section>
  );
}
`;
const scope = {
  data: [{ name: 'Acme', amount: 100 }, { name: 'Globex', amount: 250 }, { name: 'Initech', amount: 75 }],
  ObjectGrid: (p: any) => (
    <table className="mt-2 w-full border text-left text-sm" data-object={p.object}>
      <tbody><tr className="border-b bg-slate-100"><td className="p-2 font-semibold">object-grid({p.object}) — {p.rows} rows (injected component)</td></tr></tbody>
    </table>
  ),
};
createRoot(document.getElementById('root')!).render(<ReactRunner code={source} scope={scope} />);
