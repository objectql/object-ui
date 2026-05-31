// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ValidationPreview — read-only summary of a Validation rule draft.
 *
 * Validation is a discriminated union by `type`:
 *   script · unique · state_machine · format · cross_field · async ·
 *   custom · conditional · plus the schema-style JSONValidationSchema.
 *
 * The preview shows a shared envelope (target, message, severity,
 * active, events, priority, tags) and then a type-specific body so
 * each rule shape gets the right vocabulary instead of a generic
 * "field dump":
 *
 *   • script         → CEL condition block
 *   • unique         → unique fields + scope (CEL)
 *   • state_machine  → from→to transitions matrix
 *   • format         → regex / built-in format name
 *   • cross_field    → involved fields + cross-field condition
 *   • async          → endpoint URL + timeout
 *   • custom         → handler reference
 *   • conditional    → predicate + nested rule reference
 *
 * Severity drives the accent color (error=red, warning=amber,
 * info=blue) the same way runtime UI surfaces it.
 */

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Code2,
  Fingerprint,
  Globe2,
  Info,
  Power,
  Regex,
  ShieldAlert,
  Sigma,
  Workflow,
  XOctagon,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

type Severity = 'error' | 'warning' | 'info';

function celText(c: unknown): string | undefined {
  if (!c) return undefined;
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && typeof (c as any).source === 'string') return (c as any).source;
  return undefined;
}

function severityTone(s: Severity) {
  switch (s) {
    case 'error':
      return {
        ring: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
        text: 'text-red-700 dark:text-red-300',
        icon: XOctagon,
      };
    case 'warning':
      return {
        ring: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
        text: 'text-amber-800 dark:text-amber-300',
        icon: AlertTriangle,
      };
    case 'info':
    default:
      return {
        ring: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40',
        text: 'text-blue-800 dark:text-blue-300',
        icon: Info,
      };
  }
}

export function ValidationPreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const ruleName = String(d.name ?? name ?? '');
  const label = String(d.label ?? ruleName);
  const description = (d.description as string | undefined) ?? '';
  const type = (d.type as string | undefined) ?? 'script';
  const object = d.object as string | undefined;
  const message = (d.message as string | undefined) ?? '';
  const severity: Severity = ((d.severity as Severity | undefined) ?? 'error');
  const active = d.active !== false;
  const events = Array.isArray(d.events) ? (d.events as string[]) : [];
  const priority = d.priority as number | undefined;
  const tags = Array.isArray(d.tags) ? (d.tags as string[]) : [];
  const tone = severityTone(severity);

  if (!ruleName) {
    return (
      <PreviewShell hint="validation">
        <PreviewMessage>Give the validation a name to see the preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`validation · ${type}`}>
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="rounded border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{ruleName}</span>
                  <span className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">{type}</span>
                </div>
                {description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <Pill icon={Power} label={active ? 'Active' : 'Disabled'} tone={active ? 'green' : 'gray'} />
                  {object && <Pill label={`object: ${object}`} mono />}
                  {priority != null && <Pill label={`priority ${priority}`} />}
                  {events.length > 0 && (
                    <Pill label={`on ${events.join(', ')}`} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Message + severity callout */}
          <div className={`rounded border p-2.5 text-xs ${tone.ring}`}>
            <div className={`flex items-start gap-1.5 ${tone.text}`}>
              <tone.icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium uppercase tracking-wider text-[10px]">{severity}</div>
                <div className="font-normal mt-0.5 text-foreground">
                  {message || <span className="italic text-muted-foreground">no message set</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Type-specific body */}
          <TypeBody type={type} d={d} />

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Tags
              </div>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function TypeBody({ type, d }: { type: string; d: Record<string, unknown> }) {
  switch (type) {
    case 'script':
    case 'conditional':
      return (
        <Section title="Condition" icon={Code2}>
          <CelBlock value={celText(d.condition) ?? celText(d.expression)} />
        </Section>
      );

    case 'unique': {
      const fields = Array.isArray(d.fields) ? (d.fields as string[]) : [];
      const scope = celText(d.scope) ?? celText(d.where);
      return (
        <>
          <Section title={`Unique on ${fields.length} field${fields.length === 1 ? '' : 's'}`} icon={Fingerprint}>
            <div className="flex flex-wrap gap-1">
              {fields.length === 0 ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">no fields set</span>
              ) : (
                fields.map((f) => (
                  <span key={f} className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono">
                    {f}
                  </span>
                ))
              )}
            </div>
          </Section>
          {scope && (
            <Section title="Scope" icon={Sigma}>
              <CelBlock value={scope} />
            </Section>
          )}
        </>
      );
    }

    case 'state_machine': {
      // ADR-0020 shape: transitions is a `{ fromState: [allowedToStates] }` map.
      const transitionMap =
        d.transitions && typeof d.transitions === 'object' && !Array.isArray(d.transitions)
          ? (d.transitions as Record<string, string[]>)
          : {};
      const entries = Object.entries(transitionMap);
      const field = d.field as string | undefined;
      return (
        <Section title={`Transitions${field ? ` on ${field}` : ''}`} icon={Workflow}>
          {entries.length === 0 ? (
            <div className="text-xs text-amber-700 dark:text-amber-400">No transitions declared.</div>
          ) : (
            <ul className="rounded border bg-background divide-y text-xs">
              {entries.map(([from, tos]) => (
                <li key={from} className="flex items-center gap-2 px-2.5 py-1.5">
                  <span className="font-mono">{from}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {Array.isArray(tos) && tos.length > 0 ? tos.join(' | ') : '∅ (dead-end)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      );
    }

    case 'format': {
      const pattern = (d.pattern as string | undefined) ?? (d.regex as string | undefined);
      const format = d.format as string | undefined;
      return (
        <Section title="Format" icon={Regex}>
          <div className="rounded border bg-background p-2.5 text-xs space-y-1">
            {format && (
              <div>
                <span className="text-muted-foreground">Built-in:</span>{' '}
                <code className="font-mono">{format}</code>
              </div>
            )}
            {pattern && (
              <div>
                <span className="text-muted-foreground">Pattern:</span>{' '}
                <code className="font-mono break-all">{pattern}</code>
              </div>
            )}
            {!format && !pattern && <span className="text-amber-700 dark:text-amber-400">No format or regex set.</span>}
          </div>
        </Section>
      );
    }

    case 'cross_field': {
      const fields = Array.isArray(d.fields) ? (d.fields as string[]) : [];
      const condition = celText(d.condition);
      return (
        <>
          <Section title="Fields involved" icon={Sigma}>
            <div className="flex flex-wrap gap-1">
              {fields.map((f) => (
                <span key={f} className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono">
                  {f}
                </span>
              ))}
              {fields.length === 0 && <span className="text-xs text-muted-foreground italic">none</span>}
            </div>
          </Section>
          <Section title="Cross-field condition" icon={Code2}>
            <CelBlock value={condition} />
          </Section>
        </>
      );
    }

    case 'async': {
      const endpoint = (d.endpoint as string | undefined) ?? (d.url as string | undefined);
      const timeout = d.timeoutMs as number | undefined;
      const method = (d.method as string | undefined) ?? 'POST';
      return (
        <Section title="Async endpoint" icon={Globe2}>
          <div className="rounded border bg-background p-2.5 text-xs space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{method}</span>
              <code className="font-mono break-all">{endpoint ?? '—'}</code>
            </div>
            {timeout != null && (
              <div className="text-muted-foreground">timeout: {timeout}ms</div>
            )}
          </div>
        </Section>
      );
    }

    case 'custom': {
      const handler = (d.handler as string | undefined) ?? (d.function as string | undefined);
      return (
        <Section title="Custom handler" icon={Code2}>
          <div className="rounded border bg-background px-2.5 py-1.5 text-xs">
            {handler ? <code className="font-mono break-all">{handler}</code> : <span className="text-amber-700 dark:text-amber-400">No handler set.</span>}
          </div>
        </Section>
      );
    }

    default:
      return (
        <Section title="Rule" icon={ShieldAlert}>
          <div className="rounded border bg-background p-2.5 text-xs text-muted-foreground italic">
            Unknown rule type "{type}". Showing common fields only.
          </div>
        </Section>
      );
  }
}

function CelBlock({ value }: { value: string | undefined }) {
  if (!value) {
    return <div className="text-xs text-amber-700 dark:text-amber-400">No expression set.</div>;
  }
  return (
    <pre className="rounded border bg-background p-2.5 text-xs font-mono whitespace-pre-wrap break-words">
      {value}
    </pre>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{title}</span>
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
  tone?: 'gray' | 'green';
  mono?: boolean;
}) {
  const cls = tone === 'green' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className={`${cls} ${mono ? 'font-mono' : ''}`}>{label}</span>
    </span>
  );
}
