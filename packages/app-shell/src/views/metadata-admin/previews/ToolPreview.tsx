// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ToolPreview — read-only summary of an AI Tool metadata draft.
 *
 * AI tools are LLM-callable functions whose contract is a JSON Schema
 * in `parameters`. The preview renders:
 *
 *   1. A header strip: machine name, label, target object.
 *   2. The description verbatim (this is what the LLM reads to decide
 *      when to call the tool, so authors must be able to skim it).
 *   3. An **input parameters** table extracted from the JSON Schema:
 *      one row per top-level property with type, required marker,
 *      description, enum hints, and default value.
 *   4. An **output schema** mirror table when `outputSchema` is set.
 *   5. A skeletal "example invocation" panel showing what the LLM
 *      would emit if it called the tool with required fields stubbed.
 *
 * We do not run the tool from the preview — invocation requires auth,
 * permission checks, and live datasource access that the preview
 * sandbox doesn't provide. Authors get an `Open in API Console` link
 * for end-to-end testing.
 *
 * NO FLAG PILLS — deliberate (objectstack#3715 / #3896, objectui#3236).
 * The header strip used to render `requiresConfirmation`, `active`,
 * `builtIn` and `category`. All four were removed from the spec's
 * `ToolSchema`, which is now `.strict()` and rejects them by name with an
 * upgrade prescription, so no new tool metadata can carry them. Rendering
 * them for stale stored rows was worse than useless: `Requires
 * confirmation` advertised a safety pause no execution path has ever
 * performed (a real gate is `action.ai.requiresConfirmation` + the HITL
 * approval queue), and `Disabled` claimed a tool had been withdrawn while
 * the registry kept handing it to the LLM. Do not re-add a pill for any
 * of these names — the "stale draft" tests in `ToolPreview.test.tsx` fail
 * if you do. Any new pill must correspond to a key the spec still accepts
 * AND a behavior the runtime actually performs.
 */

import * as React from 'react';
import {
  Box,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  FileJson,
  Wrench,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry.js';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell.js';

interface JsonSchemaProp {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  format?: string;
  items?: JsonSchemaProp;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
  $ref?: string;
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
  description?: string;
}

function isObjectSchema(s: unknown): s is JsonSchema {
  return !!s && typeof s === 'object' && typeof (s as JsonSchema).properties === 'object';
}

function typeLabel(p: JsonSchemaProp): string {
  if (!p) return 'any';
  if (Array.isArray(p.type)) return p.type.join('|');
  if (p.type === 'array' && p.items) return `${typeLabel(p.items)}[]`;
  if (p.$ref) return p.$ref.split('/').pop() || 'ref';
  return p.type ?? 'any';
}

function stubValue(p: JsonSchemaProp): unknown {
  if (p.default !== undefined) return p.default;
  if (Array.isArray(p.enum) && p.enum.length) return p.enum[0];
  const t = Array.isArray(p.type) ? p.type[0] : p.type;
  switch (t) {
    case 'string':
      return p.format ? `<${p.format}>` : '<string>';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

export function ToolPreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const toolName = String(d.name ?? name ?? '');
  const label = String(d.label ?? toolName);
  const description = String(d.description ?? '');
  const objectName = (d.objectName as string | undefined) || undefined;

  const parameters = (d.parameters ?? {}) as JsonSchema;
  const outputSchema = (d.outputSchema ?? undefined) as JsonSchema | undefined;
  const props = isObjectSchema(parameters) ? parameters.properties ?? {} : {};
  const required = new Set(Array.isArray(parameters.required) ? parameters.required : []);

  const exampleArgs = React.useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const key of required) {
      if (props[key]) out[key] = stubValue(props[key]);
    }
    // If there are no required fields, show the first optional one to
    // give the LLM a reasonable example shape.
    if (Object.keys(out).length === 0) {
      const firstKey = Object.keys(props)[0];
      if (firstKey) out[firstKey] = stubValue(props[firstKey]);
    }
    return out;
  }, [props, required]);

  if (!toolName && !description && Object.keys(props).length === 0) {
    return (
      <PreviewShell hint="tool">
        <PreviewMessage>Set name, description, and parameters to see the tool preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell
      hint="tool"
      toolbar={
        toolName && (
          <a
            // `/execute` is the verb service-ai mounts (buildToolRoutes). This
            // link said `/invoke`, which nothing has ever mounted, so "Open in
            // API Console" landed on a path that could only 404 — the same
            // shape as the three dead AI endpoints framework#3718 removed.
            href={`/developer/api-console?path=/api/v1/ai/tools/${encodeURIComponent(toolName)}/execute`}
            target="_blank"
            rel="noreferrer"
            className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            title="Open API Console to test invocation"
          >
            Open in API Console <ExternalLink className="h-3 w-3" />
          </a>
        )
      }
    >
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="rounded border bg-muted/30 p-3 space-y-1">
            <div className="flex items-start gap-2">
              <Wrench className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{toolName}</span>
                </div>
                {objectName && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <Pill icon={Database} label={objectName} mono />
                  </div>
                )}
              </div>
            </div>
            {description && (
              <div className="pl-6 text-xs text-foreground whitespace-pre-wrap">{description}</div>
            )}
          </div>

          {/* Parameters */}
          <Section title="Input Parameters" count={Object.keys(props).length}>
            {Object.keys(props).length === 0 ? (
              <Empty>This tool takes no input parameters.</Empty>
            ) : (
              <ParamTable props={props} required={required} />
            )}
          </Section>

          {/* Example invocation */}
          {Object.keys(props).length > 0 && (
            <Section title="Example LLM Call" icon={FileJson}>
              <pre className="m-0 rounded border bg-background p-2.5 text-xs font-mono overflow-auto max-h-[200px]">
{`{
  "tool": "${toolName}",
  "arguments": ${JSON.stringify(exampleArgs, null, 2).replace(/\n/g, '\n  ')}
}`}
              </pre>
            </Section>
          )}

          {/* Output */}
          {isObjectSchema(outputSchema) && outputSchema.properties && Object.keys(outputSchema.properties).length > 0 && (
            <Section title="Output Schema" count={Object.keys(outputSchema.properties).length} icon={Box}>
              <ParamTable
                props={outputSchema.properties}
                required={new Set(Array.isArray(outputSchema.required) ? outputSchema.required : [])}
              />
            </Section>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function ParamTable({ props, required }: { props: Record<string, JsonSchemaProp>; required: Set<string> }) {
  const keys = Object.keys(props);
  return (
    <div className="rounded border bg-background overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-2.5 py-1.5 font-medium">Name</th>
            <th className="px-2.5 py-1.5 font-medium">Type</th>
            <th className="px-2.5 py-1.5 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {keys.map((k) => {
            const p = props[k];
            const isReq = required.has(k);
            return (
              <tr key={k} className="align-top">
                <td className="px-2.5 py-1.5 font-mono">
                  <div className="flex items-center gap-1">
                    {isReq ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    {k}
                    {isReq && <span className="text-[9px] uppercase text-emerald-700 ml-1">req</span>}
                  </div>
                </td>
                <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{typeLabel(p)}</td>
                <td className="px-2.5 py-1.5">
                  {p.description && <div>{p.description}</div>}
                  {Array.isArray(p.enum) && p.enum.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      enum: {p.enum.map((v) => JSON.stringify(v)).join(' | ')}
                    </div>
                  )}
                  {p.default !== undefined && (
                    <div className="text-[10px] text-muted-foreground">
                      default: <code className="font-mono">{JSON.stringify(p.default)}</code>
                    </div>
                  )}
                  {p.format && (
                    <div className="text-[10px] text-muted-foreground">format: {p.format}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic">{children}</div>;
}

// `tone` ('green' for Active, 'amber' for Requires confirmation) went away with
// the flag pills themselves — the surviving caller is the neutral object-name
// pill. A tone vocabulary kept alive with no caller is how the removed pills
// grow back.
function Pill({
  icon: Icon,
  label,
  mono = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className={`text-foreground ${mono ? 'font-mono' : ''}`}>{label}</span>
    </span>
  );
}
