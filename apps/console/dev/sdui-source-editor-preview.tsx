/* Verifies the Studio editor fix: opening a kind:'react'/'html' page shows the
 * SourcePageEditor (code + live preview) instead of crashing on the design
 * canvas. Mounts the real PagePreview with a react-page draft. Dev-only. */
import '../src/index.css';
import '@object-ui/components';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SchemaRendererProvider, AdapterCtx } from '@object-ui/react';
import { I18nProvider } from '@object-ui/i18n';
import { PagePreview } from '../../../packages/app-shell/src/views/metadata-admin/previews/PagePreview';

const initialReact = `function Page() {
  const [n, setN] = React.useState(0);
  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold text-slate-900">Hello from source</h1>
      <p className="mt-1 text-slate-500">This page is edited as source, not a region tree.</p>
      <button onClick={() => setN(n + 1)} className="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500">Count {n}</button>
    </div>
  );
}`;

function Harness() {
  const [draft, setDraft] = React.useState<Record<string, unknown>>({
    type: 'page', kind: 'react', name: 'demo_source_page', label: 'Demo', source: initialReact,
  });
  return (
    <div className="flex h-screen flex-col">
      <div className="border-b bg-white px-4 py-2 text-sm font-semibold">Studio · editing a kind:'react' page</div>
      <div className="min-h-0 flex-1">
        <PagePreview
          type="page"
          name="demo_source_page"
          draft={draft as never}
          editing
          selection={null as never}
          onSelectionChange={() => {}}
          onPatch={(patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch }))}
          locale={'en' as never}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AdapterCtx.Provider value={null}>
        <SchemaRendererProvider dataSource={{}}>
          <Harness />
        </SchemaRendererProvider>
      </AdapterCtx.Provider>
    </I18nProvider>
  </React.StrictMode>,
);
