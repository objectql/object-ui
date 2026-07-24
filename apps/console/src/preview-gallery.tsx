/**
 * DEV-ONLY metadata-designer gallery harness.
 *
 * Renders every registered metadata Preview (the "designers") with a
 * representative sample draft inside chrome that mirrors the real
 * ResourceEditPage canvas (dotted-grid background, toolbar, edit mode +
 * live selection/patch state). Lets us browser-test and beautify each
 * designer without a live backend.
 *
 * Served as a standalone Vite entry: open /preview-gallery.html.
 * Excluded from the production build (no route references it).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { I18nProvider } from '@object-ui/i18n';
import { ComponentRegistry } from '@object-ui/core';

// Register the renderers the schema-driven previews rely on.
import '@object-ui/plugin-grid';
import '@object-ui/plugin-form';
import '@object-ui/plugin-view';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';

// Lazy renderers used by the dashboard / report designers.
for (const variant of [
  'dashboard',
  'metric',
  'metric-card',
  'object-metric',
  'pivot',
  'dashboard-grid',
]) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-dashboard'), {
    namespace: 'plugin-dashboard',
    category: 'view',
  });
}
for (const variant of ['chart', 'bar-chart', 'line-chart', 'pie-chart', 'area-chart']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-charts'), {
    namespace: 'plugin-charts',
    category: 'chart',
  });
}

import {
  getMetadataPreview,
  listMetadataPreviewTypes,
  getMetadataInspector,
} from '@object-ui/app-shell';
import type { MetadataSelection } from '@object-ui/app-shell';
import { SAMPLES } from './preview-samples';

// Importing the @object-ui/app-shell root registers built-in previews and
// inspectors as a module side-effect, so no explicit registration is needed.

const ORDER = [
  'object',
  'page',
  'view',
  'dashboard',
  'app',
  'report',
  'flow',
  'workflow',
  'approval',
  'job',
  'agent',
  'tool',
  'skill',
  'action',
  'permission',
  'profile',
  'role',
  'validation',
  'datasource',
  'translation',
  'email_template',
];

/**
 * Dev-harness locale override — `?locale=zh-CN` (or `#locale=zh-CN`) renders the
 * designers in that locale so i18n coverage can be eyeballed / browser-tested
 * without wiring the full console LocaleSwitcher. Defaults to English.
 */
function galleryLocale(): string {
  if (typeof window === 'undefined') return 'en-US';
  const q = new URLSearchParams(window.location.search).get('locale');
  const h = window.location.hash.match(/locale=([a-zA-Z-]+)/)?.[1];
  return q ?? h ?? 'en-US';
}

function DesignerCard({ type }: { type: string }) {
  const Preview = getMetadataPreview(type);
  const [draft, setDraft] = React.useState<Record<string, unknown>>(
    () => SAMPLES[type] ?? { name: type, label: type },
  );
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);

  if (!Preview) return null;

  const onPatch = (patch: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const Inspector = selection ? getMetadataInspector(type) : undefined;
  const locale = galleryLocale();

  return (
    <section className="scroll-mt-4" id={`designer-${type}`}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{type}</h2>
        <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {String(draft.name ?? '')}
        </code>
        {selection && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
            selected: {selection.label ?? selection.id}
          </span>
        )}
      </div>
      {/* Mirror the ResourceEditPage canvas chrome */}
      <div className="relative flex h-[520px] flex-col overflow-hidden rounded-md border bg-background">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
          <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
            <span className="rounded bg-background px-2 py-1 text-xs text-foreground shadow-sm">
              Design
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">designer · {type}</span>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex-1 min-h-0 overflow-auto bg-muted/30 p-4 bg-[radial-gradient(circle_at_1px_1px,theme(colors.border)_1px,transparent_0)] [background-size:16px_16px]">
            {React.createElement(Preview, {
              type,
              name: String(draft.name ?? ''),
              draft,
              editing: true,
              selection,
              onSelectionChange: setSelection,
              onPatch,
              locale,
            })}
          </div>
          {Inspector && selection && (
            <div className="w-80 shrink-0 overflow-auto border-l bg-background">
              {React.createElement(Inspector, {
                type,
                name: String(draft.name ?? ''),
                draft,
                selection,
                onPatch,
                onClearSelection: () => setSelection(null),
                onSelectionChange: setSelection,
                readOnly: false,
                locale,
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  const registered = new Set(listMetadataPreviewTypes());
  const all = ORDER.filter((t) => registered.has(t));
  // Dev-harness isolation: `?only=flow` (or `#only=flow`) renders a single
  // designer full-width so browser automation can interact without the other
  // stacked designers churning element refs.
  const only = React.useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('only');
    const h = window.location.hash.match(/only=([a-z_]+)/)?.[1];
    return q ?? h ?? null;
  }, []);
  const types = only && all.includes(only) ? [only] : all;
  const [active, setActive] = React.useState(types[0]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight">Metadata Designer Gallery</h1>
        <p className="text-xs text-muted-foreground">
          {types.length} designer{types.length === 1 ? '' : 's'} · dev harness
          {only ? ` · isolated: ${only}` : ''} · {' '}
          <span className="text-muted-foreground/80">
            view/dashboard/report need a live data adapter and degrade to empty states here
          </span>
        </p>
        {!only && (
          <nav className="mt-2 flex flex-wrap gap-1">
            {all.map((t) => (
              <a
                key={t}
                href={`#designer-${t}`}
                onClick={() => setActive(t)}
                className={
                  'rounded px-2 py-0.5 text-[11px] transition-colors ' +
                  (active === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70')
                }
              >
                {t}
              </a>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        {types.map((t) => (
          <DesignerCard key={t} type={t} />
        ))}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider config={{ defaultLanguage: 'en' }}>
      <Gallery />
    </I18nProvider>
  </React.StrictMode>,
);
