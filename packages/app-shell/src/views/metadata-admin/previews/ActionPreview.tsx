// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ActionPreview — read-only summary of an Action metadata draft.
 *
 * Actions are the configurable buttons / menu items / shortcuts a
 * record or list surfaces. The preview shows:
 *
 *   1. A faux button rendered using the action's `variant`, `icon`,
 *      and `label` so authors can see the visual weight before they
 *      ship it (primary buttons are highlighted, danger turns red,
 *      icon-only actions render a compact icon button).
 *   2. A metadata strip: type, target, locations, shortcut, bulk
 *      flag, AI exposure, refreshAfter, confirmText.
 *   3. A params table when the action prompts the user — this is the
 *      modal/drawer it would open on click. We render it as a static
 *      preview, not an interactive form, because previews must be
 *      side-effect free.
 *   4. A "what happens on click" callout that describes the resolved
 *      handler in plain language (e.g. "POST ${target}", "open form
 *      ${target}", "run script ${target}").
 *   5. A resultDialog mock when configured (TOTP / backup-codes-style
 *      reveal dialogs).
 */

import * as React from 'react';
import {
  AlertTriangle,
  Bot,
  Code2,
  Eye,
  Globe,
  Keyboard,
  LayoutGrid,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  ScanLine,
  Sparkles,
  Square,
  Workflow,
  icons as lucideIcons,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

interface ActionParam {
  name?: string;
  field?: string;
  label?: string | { en?: string };
  type?: string;
  required?: boolean;
  options?: Array<{ label: string | { en?: string }; value: string }>;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  defaultFromRow?: boolean;
}

interface ResultDialogField {
  path: string;
  label?: string | { en?: string };
  format?: 'qrcode' | 'code-list' | 'secret' | 'text' | 'json';
}

interface ResultDialog {
  title?: string | { en?: string };
  description?: string | { en?: string };
  acknowledge?: string | { en?: string };
  format?: 'qrcode' | 'code-list' | 'secret' | 'text' | 'json';
  fields?: ResultDialogField[];
}

function localize(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, string>;
    return o.en ?? o['en-US'] ?? Object.values(o)[0] ?? '';
  }
  return String(v);
}

function typeIcon(type: string) {
  switch (type) {
    case 'url':
      return Link2;
    case 'modal':
      return LayoutGrid;
    case 'flow':
      return Workflow;
    case 'api':
      return Globe;
    case 'form':
      return Pencil;
    case 'script':
    default:
      return Code2;
  }
}

function variantClasses(variant?: string): string {
  switch (variant) {
    case 'primary':
    case 'default':
    case undefined:
      // Shadcn-native default button is a solid primary, not an outline.
      return 'bg-primary text-primary-foreground hover:opacity-90';
    case 'danger':
    case 'destructive':
      return 'bg-red-600 text-white hover:bg-red-700';
    case 'secondary':
      return 'bg-secondary text-secondary-foreground hover:opacity-90';
    case 'ghost':
      return 'bg-transparent text-foreground hover:bg-accent';
    case 'link':
      return 'bg-transparent text-primary underline-offset-2 hover:underline px-0';
    default:
      // 'outline' and any unrecognized variant fall back to a bordered button.
      return 'border bg-background text-foreground hover:bg-accent';
  }
}

function describeHandler(type: string, target?: string, hasBody?: boolean): string {
  if (!target && !hasBody) return 'No handler bound yet.';
  switch (type) {
    case 'url':
      return `Navigate to ${target}`;
    case 'flow':
      return `Run flow ${target}`;
    case 'modal':
      return `Open modal ${target}`;
    case 'api':
      return `Call API endpoint ${target}`;
    case 'form':
      return `Open form view ${target} (/console/forms/${target ?? '?'})`;
    case 'script':
      return hasBody
        ? 'Run inline script body (L1 expression or L2 sandboxed JS).'
        : `Run named script ${target}`;
    default:
      return `Invoke ${target}`;
  }
}

export function ActionPreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const actionName = String(d.name ?? name ?? '');
  const label = localize(d.label) || actionName;
  const icon = (d.icon as string | undefined) || undefined;
  const type = String(d.type ?? 'script');
  const target = (d.target as string | undefined) ?? (d.execute as string | undefined);
  const variant = (d.variant as string | undefined) || undefined;
  const component = String(d.component ?? '');
  const locations = Array.isArray(d.locations) ? (d.locations as string[]) : [];
  const shortcut = (d.shortcut as string | undefined) || undefined;
  const bulkEnabled = !!d.bulkEnabled;
  const refreshAfter = !!d.refreshAfter;
  const aiExposed = d.aiExposed;
  const confirmText = localize(d.confirmText);
  const successMessage = localize(d.successMessage);
  const params: ActionParam[] = Array.isArray(d.params) ? (d.params as ActionParam[]) : [];
  const resultDialog = d.resultDialog as ResultDialog | undefined;
  const body = d.body as { language?: string; source?: string } | undefined;
  const objectName = (d.objectName as string | undefined) || undefined;
  const visible = d.visible as unknown;
  const disabled = d.disabled as unknown;
  const method = (d.method as string | undefined) || 'POST';
  const bodyExtra = d.bodyExtra;

  const TypeIcon = typeIcon(type);
  const iconOnly = component === 'action:icon';

  if (!actionName && !label) {
    return (
      <PreviewShell hint="action">
        <PreviewMessage>Set name and label to see the action preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint="action">
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Faux button mock */}
          <div className="rounded border bg-muted/30 p-4 flex items-center justify-center min-h-[80px]">
            <FauxButton label={label} icon={icon} variant={variant} iconOnly={iconOnly} disabled={!!disabled && typeof disabled === 'boolean'} />
          </div>

          {/* Metadata strip */}
          <div className="rounded border bg-background p-3 text-xs space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{actionName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <Pill icon={TypeIcon} label={`type: ${type}`} />
              {objectName && <Pill icon={Square} label={`object: ${objectName}`} mono />}
              {variant && <Pill label={`variant: ${variant}`} />}
              {component && <Pill icon={MoreHorizontal} label={component} />}
              {shortcut && <Pill icon={Keyboard} label={shortcut} mono />}
              {bulkEnabled && <Pill icon={ScanLine} label="bulk" tone="green" />}
              {refreshAfter && <Pill icon={RefreshCw} label="refresh after" />}
              {aiExposed === false && <Pill icon={Bot} label="AI: opted out" tone="amber" />}
              {aiExposed === true && <Pill icon={Sparkles} label="AI: exposed" />}
            </div>
            {locations.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-muted-foreground">Locations:</span>
                {locations.map((l) => (
                  <span key={l} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                    {l}
                  </span>
                ))}
              </div>
            )}
            {Boolean(typeof visible === 'string' || (visible && typeof visible === 'object')) && (
              <ConditionLine label="Visible when" value={visible} icon={Eye} />
            )}
            {disabled != null && typeof disabled !== 'boolean' && (
              <ConditionLine label="Disabled when" value={disabled} icon={Lock} />
            )}
          </div>

          {/* On-click description */}
          <div className="rounded border border-blue-200 bg-blue-50 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-blue-900 mb-0.5">
              {/* eslint-disable-next-line react-hooks/static-components -- typeIcon returns a stable icon component from a static registry, not one created during render */}
              <TypeIcon className="h-3.5 w-3.5" /> On click
            </div>
            <div className="text-blue-950 font-mono break-all">
              {describeHandler(type, target, !!body?.source)}
            </div>
            {confirmText && (
              <div className="mt-1.5 flex items-start gap-1.5 text-amber-900">
                <AlertTriangle className="h-3 w-3 mt-0.5" />
                <span>First asks: <em>{confirmText}</em></span>
              </div>
            )}
            {successMessage && (
              <div className="mt-1.5 text-blue-950">
                On success: <em>{successMessage}</em>
              </div>
            )}
          </div>

          {/* Placement simulation — where this action surfaces */}
          {locations.length > 0 && (
            <Section title="Where it appears">
              <PlacementPreview locations={locations} label={label} icon={icon} variant={variant} iconOnly={iconOnly} />
            </Section>
          )}

          {/* Test request — api type */}
          {type === 'api' && !!target && (
            <Section title="Test request" icon={Globe}>
              <ApiTestPanel target={target} method={method} bodyExtra={bodyExtra} params={params} />
            </Section>
          )}

          {/* Param dialog mock */}
          {params.length > 0 && (
            <Section title="Input Dialog" count={params.length}>
              <DialogMock title={label} params={params} variant={variant} />
            </Section>
          )}

          {/* Result dialog mock */}
          {resultDialog && (
            <Section title="Result Dialog" icon={Eye}>
              <ResultDialogMock dialog={resultDialog} />
            </Section>
          )}

          {/* Body excerpt (script type) */}
          {body?.source && (
            <Section title={`Script Body (${body.language ?? 'expression'})`} icon={Code2}>
              <pre className="m-0 rounded border bg-background p-2.5 text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-auto">
                {body.source}
              </pre>
            </Section>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function FauxButton({
  label,
  icon,
  variant,
  iconOnly,
  disabled,
}: {
  label: string;
  icon?: string;
  variant?: string;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const cls = `inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium pointer-events-none ${variantClasses(variant)} ${disabled ? 'opacity-50' : ''}`;
  return (
    <button type="button" className={cls} aria-disabled disabled>
      {icon && <IconHint name={icon} />}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

/**
 * Render the action's bound Lucide icon by name (kebab- or PascalCase).
 * Falls back to a compact name chip when the icon can't be resolved, so
 * the author still sees that an icon binding is in place.
 */
function IconHint({ name }: { name: string }) {
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const resolved = pascal === 'Home' ? 'House' : pascal;
  const Glyph = (lucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[resolved];

  if (Glyph) {
    return <Glyph className="h-4 w-4" aria-hidden />;
  }

  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-white/30 px-1 text-[9px] uppercase font-mono">
      {name.slice(0, 3)}
    </span>
  );
}

function DialogMock({ title, params, variant }: { title: string; params: ActionParam[]; variant?: string }) {
  return (
    <div className="rounded border bg-background shadow-sm">
      <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium">{title}</div>
      <div className="p-3 space-y-2">
        {params.map((p, i) => {
          const fieldName = p.name ?? p.field ?? `param_${i}`;
          const fieldLabel = localize(p.label) || fieldName;
          return (
            <div key={i} className="space-y-0.5">
              <label className="text-xs flex items-center gap-1">
                {fieldLabel}
                {p.required && <span className="text-red-600 text-[10px]">*</span>}
                <span className="ml-1 font-mono text-[9px] text-muted-foreground">{fieldName}</span>
                {p.type && <span className="font-mono text-[9px] text-muted-foreground">{p.type}</span>}
              </label>
              {renderFieldMock(p)}
              {p.helpText && <div className="text-[10px] text-muted-foreground">{p.helpText}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-3 py-2">
        <button type="button" disabled className="text-xs px-2.5 py-1 rounded border bg-background pointer-events-none">Cancel</button>
        <button type="button" disabled className={`text-xs px-2.5 py-1 rounded pointer-events-none ${variantClasses(variant || 'primary')}`}>OK</button>
      </div>
    </div>
  );
}

function renderFieldMock(p: ActionParam): React.ReactElement {
  const cls = 'w-full text-xs px-2 py-1 border rounded bg-background pointer-events-none';
  const placeholder = p.placeholder || (p.defaultFromRow ? '(from selected row)' : '');
  const def = p.defaultValue;
  if (Array.isArray(p.options) && p.options.length > 0) {
    return (
      <select className={cls} disabled value="">
        <option value="">{placeholder || '— select —'}</option>
        {p.options.map((o, i) => (
          <option key={i} value={o.value}>
            {localize(o.label)}
          </option>
        ))}
      </select>
    );
  }
  if (p.type === 'boolean') {
    return (
      <label className="inline-flex items-center gap-1.5 text-xs">
        <input type="checkbox" disabled className="pointer-events-none" /> Toggle
      </label>
    );
  }
  if (p.type === 'textarea' || p.type === 'html' || p.type === 'long_text') {
    return <textarea className={`${cls} min-h-[48px]`} placeholder={placeholder} value={def != null ? String(def) : ''} readOnly />;
  }
  return (
    <input
      type={p.type === 'number' || p.type === 'integer' ? 'number' : p.type === 'date' ? 'date' : 'text'}
      className={cls}
      placeholder={placeholder}
      value={def != null ? String(def) : ''}
      readOnly
    />
  );
}

function ResultDialogMock({ dialog }: { dialog: ResultDialog }) {
  const title = localize(dialog.title) || 'Result';
  const description = localize(dialog.description);
  const acknowledge = localize(dialog.acknowledge) || 'I have saved this';
  const fields = dialog.fields ?? [];
  return (
    <div className="rounded border bg-background shadow-sm">
      <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium">{title}</div>
      <div className="p-3 space-y-2 text-xs">
        {description && <div className="text-muted-foreground">{description}</div>}
        {fields.length === 0 ? (
          <div className="text-muted-foreground italic">Renders full JSON response.</div>
        ) : (
          <ul className="space-y-1.5">
            {fields.map((f, i) => (
              <li key={i} className="rounded border bg-muted/20 p-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{localize(f.label) || f.path}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{f.path}</span>
                  <span className="ml-auto font-mono text-[9px] uppercase text-muted-foreground">
                    {f.format ?? dialog.format ?? 'json'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-end border-t bg-muted/20 px-3 py-2">
        <button type="button" disabled className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground pointer-events-none">
          {acknowledge}
        </button>
      </div>
    </div>
  );
}

function ConditionLine({ label, value, icon: Icon }: { label: string; value: unknown; icon: React.ComponentType<{ className?: string }> }) {
  const src = typeof value === 'string' ? value : (value as { source?: string })?.source ?? JSON.stringify(value);
  return (
    <div className="flex items-start gap-1.5 pt-0.5">
      <Icon className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <code className="font-mono break-all">{src}</code>
    </div>
  );
}

function Section({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{title}</span>
        {count != null && <span className="opacity-70">({count})</span>}
      </div>
      {children}
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
  tone = 'gray',
  mono = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: 'gray' | 'green' | 'amber';
  mono?: boolean;
}) {
  const cls =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className={`${cls} ${mono ? 'font-mono' : ''}`}>{label}</span>
    </span>
  );
}


/* ─────────────── Placement simulation (where it appears) ─────────────── */

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">{label}</div>
      {children}
    </div>
  );
}

function PlacementPreview({ locations, label, icon, variant, iconOnly }: {
  locations: string[]; label: string; icon?: string; variant?: string; iconOnly?: boolean;
}) {
  const btn = <FauxButton label={label} icon={icon} variant={variant} iconOnly={iconOnly} />;
  return (
    <div className="space-y-2.5">
      {locations.includes('record_header') && (
        <Frame label="record_header">
          <div className="rounded border bg-background">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-muted" />
                <div>
                  <div className="text-xs font-medium">Sample record</div>
                  <div className="text-[10px] text-muted-foreground">Record detail</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">{btn}</div>
            </div>
            <div className="p-3 text-[10px] text-muted-foreground">…record body…</div>
          </div>
        </Frame>
      )}
      {locations.includes('list_toolbar') && (
        <Frame label="list_toolbar">
          <div className="rounded border bg-background">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <div className="text-xs font-medium">Records</div>
              <div className="flex items-center gap-1.5">{btn}</div>
            </div>
            <div className="px-3 py-2 text-[10px] text-muted-foreground">row 1 · row 2 · row 3</div>
          </div>
        </Frame>
      )}
      {locations.includes('list_item') && (
        <Frame label="list_item">
          <div className="divide-y rounded border bg-background">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="text-[11px]">Row {i + 1}</span>
                <div className="origin-right scale-90">{btn}</div>
              </div>
            ))}
          </div>
        </Frame>
      )}
      {(locations.includes('record_section') || locations.includes('record_related')) && (
        <Frame label={locations.includes('record_related') ? 'record_related' : 'record_section'}>
          <div className="rounded border bg-background">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-medium">Section</span>
              {btn}
            </div>
            <div className="p-3 text-[10px] text-muted-foreground">…section content…</div>
          </div>
        </Frame>
      )}
      {locations.includes('record_more') && (
        <Frame label="record_more">
          <div className="w-52 rounded border bg-background">
            <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" /> More
            </div>
            <div className="px-2 py-1.5 text-xs"><div className="rounded px-1 py-0.5 hover:bg-accent">{label}</div></div>
          </div>
        </Frame>
      )}
      {locations.includes('global_nav') && (
        <Frame label="global_nav">
          <div className="rounded border bg-background">
            <div className="px-3 py-2 text-[11px] text-muted-foreground">⌘K · Command palette</div>
            <div className="border-t px-3 py-1.5 text-xs"><div className="rounded px-1 py-0.5 hover:bg-accent">{label}</div></div>
          </div>
        </Frame>
      )}
    </div>
  );
}

/* ─────────────── Test request runner (api type) ─────────────── */

function ApiTestPanel({ target, method, bodyExtra, params }: {
  target: string; method?: string; bodyExtra?: unknown; params: ActionParam[];
}) {
  const m = (method || 'POST').toUpperCase();
  const [resp, setResp] = React.useState<{ status: number; ok: boolean; body?: unknown; error?: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const reqBody = (bodyExtra && typeof bodyExtra === 'object') ? (bodyExtra as Record<string, unknown>) : {};

  const run = async () => {
    setLoading(true);
    setResp(null);
    try {
      const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('auth-session-token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const init: RequestInit = { method: m, headers, credentials: 'include' };
      if (m !== 'GET' && m !== 'HEAD') init.body = JSON.stringify(reqBody);
      const r = await fetch(target, init);
      const text = await r.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* keep text */ }
      setResp({ status: r.status, ok: r.ok, body: parsed });
    } catch (e) {
      setResp({ status: 0, ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="rounded border bg-background p-2 font-mono text-[11px] break-all">
        <span className="font-semibold">{m}</span> {target}
      </div>
      {Object.keys(reqBody).length > 0 && (
        <pre className="m-0 rounded border bg-muted/30 p-2 text-[10px] font-mono whitespace-pre-wrap">{JSON.stringify(reqBody, null, 2)}</pre>
      )}
      {params.length > 0 && (
        <div className="text-[10px] text-muted-foreground">+ {params.length} user-supplied param{params.length > 1 ? 's' : ''} collected at runtime</div>
      )}
      {m !== 'GET' && (
        <div className="flex items-start gap-1.5 text-[10px] text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Sends a real {m} request to the live backend — may modify data.</span>
        </div>
      )}
      <button type="button" onClick={run} disabled={loading}
        className="inline-flex items-center gap-1.5 rounded border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50">
        <Globe className="h-3.5 w-3.5" /> {loading ? 'Sending…' : 'Send test request'}
      </button>
      {resp && (
        <div className={'rounded border p-2 ' + (resp.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50')}>
          <div className="mb-1 text-[11px] font-medium">{resp.error ? 'Network error' : ('HTTP ' + resp.status + (resp.ok ? ' OK' : ''))}</div>
          <pre className="m-0 max-h-[200px] overflow-auto text-[10px] font-mono whitespace-pre-wrap">{resp.error ?? (typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body, null, 2))}</pre>
        </div>
      )}
    </div>
  );
}
