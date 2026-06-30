/* Browser preview for the two AI-authoring tiers, each rendered through the
 * REAL PageRenderer (not a private harness):
 *   - kind:'html'  — constrained JSX with the full native HTML tag set (h1/p/
 *     a/ul/li/img/strong/blockquote), parsed, never executed.
 *   - kind:'react' — real React (useState/map/onClick) + an injected data block,
 *     executed by @object-ui/react-runtime. Gated by CAP_REACT_PAGES, enabled
 *     here to exercise the trusted tier.
 * Tailwind v4 scans this file's text for class candidates, so the runtime
 * source strings below are fully styled. */
import './index.css';
import '@object-ui/components';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SchemaRenderer } from '@object-ui/react';
import { enableCapability, CAP_REACT_PAGES } from '@object-ui/core';

// Trusted tier on (a host would do this; never authored metadata).
enableCapability(CAP_REACT_PAGES);

const htmlSource = `
<section className="mx-auto max-w-3xl p-10">
  <h1 className="text-4xl font-bold tracking-tight text-slate-900">Release Notes</h1>
  <p className="mt-3 text-base leading-relaxed text-slate-500">A <strong className="font-semibold text-slate-700">kind:'html'</strong> page — plain native HTML tags, Tailwind classes, parsed (never executed).</p>
  <hr className="my-6 border-slate-200" />
  <h2 className="text-2xl font-semibold text-slate-800">What shipped</h2>
  <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-600">
    <li>Full HTML tag set in the <em className="italic">html</em> tier.</li>
    <li>A trusted <a href="https://objectui.org" className="font-medium text-indigo-600 underline">react tier</a> behind a flag.</li>
    <li>Author writes markup; the platform renders it.</li>
  </ul>
  <blockquote className="mt-6 border-l-4 border-indigo-300 bg-indigo-50 p-4 text-slate-700">
    <p>“The best custom page is one the AI can write and the platform can render safely.”</p>
  </blockquote>
  <img src="https://placehold.co/600x160/4f46e5/ffffff?text=kind:html" alt="banner" className="mt-6 w-full rounded-xl" />
</section>`;

const htmlPage = { type: 'home', kind: 'html', name: 'release_notes', label: 'Release Notes', source: htmlSource };

const reactSource = `
function Page() {
  const [sortKey, setSortKey] = React.useState('amount');
  const [count, setCount] = React.useState(0);
  const rows = [...data].sort((a, b) => (sortKey === 'amount' ? b.amount - a.amount : a.name.localeCompare(b.name)));
  const total = data.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="mx-auto max-w-3xl p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Pipeline (real React)</h1>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >Clicked {count} times</button>
      </div>
      <p className="mt-2 text-sm text-slate-500">useState · map · reduce · sort · onClick — executed by the runtime.</p>
      <div className="mt-4 flex gap-2 text-xs">
        {['amount', 'name'].map((k) => (
          <button key={k} onClick={() => setSortKey(k)}
            className={'rounded-full px-3 py-1 font-semibold ' + (sortKey === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}
          >sort by {k}</button>
        ))}
      </div>
      <table className="mt-4 w-full text-left text-sm">
        <thead><tr className="border-b text-slate-400"><th className="py-2">Account</th><th className="py-2 text-right">Amount</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-slate-100">
              <td className="py-2 font-medium text-slate-700">{r.name}</td>
              <td className="py-2 text-right tabular-nums text-slate-600">{'$' + r.amount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 text-right text-sm font-semibold text-slate-900">Total: {'$' + total.toLocaleString()}</div>
    </div>
  );
}`;

const reactPage = {
  type: 'home',
  kind: 'react',
  name: 'pipeline_react',
  label: 'Pipeline',
  source: reactSource,
  data: [
    { name: 'Acme', amount: 120000 },
    { name: 'Globex', amount: 88000 },
    { name: 'Initech', amount: 64000 },
    { name: 'Umbrella', amount: 152000 },
    { name: 'Soylent', amount: 41000 },
  ],
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="space-y-10 bg-slate-50">
      <div data-tier="html"><SchemaRenderer schema={htmlPage as any} /></div>
      <div className="border-t-4 border-dashed border-slate-300" />
      <div data-tier="react"><SchemaRenderer schema={reactPage as any} /></div>
    </div>
  </React.StrictMode>,
);
