// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SkillPreview — read-only summary of an AI Skill draft.
 *
 * Skills are reusable bundles of (instructions + tool whitelist +
 * trigger conditions) that agents pull in. The preview surfaces:
 *
 *   • Header pills: active flag, permission requirements, model
 *     hint if present.
 *   • Description block.
 *   • Instructions — the prompt fragment injected into the agent's
 *     system prompt, in a soft code block so the operator can read
 *     it the way the LLM will.
 *   • Tools — chip list. Wildcards (`*`, `prefix.*`) get highlighted
 *     because they expand the agent's tool surface significantly.
 *   • Trigger conditions — the AND-ed `{ field, operator, value }` triples
 *     that gate activation, rendered as a three-column table.
 *
 * NOT shown — `skill.triggerPhrases` (objectui#3275). It is a
 * `retiredKey()` tombstone in `@objectstack/spec` 17 (objectstack#3896):
 * `SkillSchema` rejects it BY NAME, so a draft carrying it cannot be
 * saved. The phrases were never matched against a user's message either,
 * so the `TRIGGER PHRASES` block this preview used to paint advertised
 * routing that no runtime performed — twice wrong. Activation is
 * `triggerConditions` intersected with the agent's `skills[]`.
 *
 * The conditions table itself was the other half of the bug: it read
 * `cond.expression ?? cond.value` with a `cond.type` gutter, none of
 * which `SkillTriggerConditionSchema` declares. A spec-valid condition
 * therefore rendered as a bare value with its `field` and `operator`
 * invisible — `COND | sales_order` instead of `objectName eq
 * sales_order`. Three columns, read straight off the schema's shape.
 */

import * as React from 'react';
import {
  Asterisk,
  BookOpen,
  Filter,
  Power,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { MetadataPreviewProps } from '../preview-registry.js';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell.js';

export function SkillPreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const skillName = String(d.name ?? name ?? '');
  const label = String(d.label ?? skillName);
  const description = (d.description as string | undefined) ?? '';
  const instructions = (d.instructions as string | undefined) ?? '';
  const tools = Array.isArray(d.tools) ? (d.tools as string[]) : [];
  const triggerConditions = Array.isArray(d.triggerConditions)
    ? (d.triggerConditions as Array<Record<string, unknown>>)
    : [];
  const active = d.active !== false;
  const model = (d.model as string | undefined) ?? undefined;

  if (!skillName) {
    return (
      <PreviewShell hint="skill">
        <PreviewMessage>Give the skill a name and at least an instructions block to see the preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint="skill">
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="rounded border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{skillName}</span>
                </div>
                {description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <Pill icon={Power} label={active ? 'Active' : 'Disabled'} tone={active ? 'green' : 'gray'} />
                  {model && <Pill label={`model: ${model}`} mono />}
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <Section title="Instructions" icon={BookOpen}>
            {instructions ? (
              <pre className="rounded border bg-background p-2.5 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
                {instructions}
              </pre>
            ) : (
              <div className="text-xs text-amber-700">No instructions yet — the skill will contribute nothing to the prompt.</div>
            )}
          </Section>

          {/* Tools */}
          <Section title={`Tools (${tools.length})`} icon={Wrench}>
            {tools.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No tools whitelisted.</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {tools.map((t) => {
                  const isWild = t.includes('*');
                  return (
                    <span
                      key={t}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono border ${
                        isWild ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-border bg-muted/40'
                      }`}
                    >
                      {isWild && <Asterisk className="h-3 w-3" />}
                      {t}
                    </span>
                  );
                })}
              </div>
            )}
            {tools.some((t) => t.includes('*')) && (
              <div className="mt-1 text-[10px] text-amber-700">
                Wildcards expand to many tools at runtime — review the matching set in the agent before activating.
              </div>
            )}
          </Section>

          {/* Trigger conditions — `{ field, operator, value }`, ANDed.
              Every column comes from a key SkillTriggerConditionSchema
              declares; nothing is inferred or defaulted. */}
          {triggerConditions.length > 0 && (
            <Section title={`Trigger Conditions (${triggerConditions.length})`} icon={Filter}>
              <div className="rounded border bg-background overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2.5 py-1.5 font-medium">Field</th>
                      <th className="px-2.5 py-1.5 font-medium">Operator</th>
                      <th className="px-2.5 py-1.5 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {triggerConditions.map((cond, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-2.5 py-1.5 font-mono break-all">
                          {renderCell(cond.field)}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-muted-foreground">
                          {renderCell(cond.operator)}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono break-all">
                          {renderCell(cond.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {triggerConditions.length > 1 && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  All conditions must hold (AND) for the skill to activate.
                </div>
              )}
            </Section>
          )}

          {/* `permissions` was REMOVED from SkillSchema (framework#3686): skill
              invocation was never gated by it, and showing a "Required
              Permissions" panel for an unenforced list taught the wrong model.
              Access is gated at the AGENT (`access`/`permissions`) or on the
              underlying actions the skill's tools call. */}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

/**
 * Render one trigger-condition cell.
 *
 * `SkillTriggerConditionSchema` declares all three of `field` / `operator` /
 * `value` as REQUIRED (`value` is `string | string[]`), so an absent or
 * wrongly-typed cell is a draft that will be rejected at publish. Say so in
 * place rather than rendering an empty cell that reads as "fine" — the whole
 * point of this preview is to surface the mistake while the author is still
 * looking at it.
 */
function renderCell(v: unknown): React.ReactNode {
  if (typeof v === 'string' && v !== '') return v;
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
    return (v as string[]).join(', ');
  }
  return (
    <span className="text-amber-700" title="Required by SkillTriggerConditionSchema — this draft will be rejected on save.">
      missing
    </span>
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
  const cls = tone === 'green' ? 'text-emerald-700' : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
      <span className={`${cls} ${mono ? 'font-mono' : ''}`}>{label}</span>
    </span>
  );
}
