// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AgentPreview — read-only summary of an AI Agent metadata draft.
 *
 * Shows the configuration an operator needs to sanity-check an agent
 * before saving:
 *   • Persona header (avatar, label, role, active flag).
 *   • Model config (provider, model id, temperature, max tokens).
 *   • System prompt / instructions in a scrollable monospace block.
 *   • Skills + Tools as two collapsible chip lists.
 *   • Knowledge sources (RAG indices) when present.
 *   • Planning + guardrails callouts.
 *
 * We intentionally do **not** wire a live chat into this preview:
 *   1. The draft may reference unsaved skills/tools the runtime can't
 *      resolve, so a chat would just error.
 *   2. AI calls cost real money; a preview tab that silently spends
 *      tokens whenever someone clicks the tab is bad UX.
 * Instead we render a "Try it" button that links to the runtime
 * agent chat (`/console/ai/agents/<name>/chat`) where the saved
 * version of this agent can be exercised properly.
 */

import * as React from 'react';
import {
  Activity,
  Bot,
  BrainCircuit,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  Lock,
  ScrollText,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { cn } from '@object-ui/components';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';

interface ModelConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ToolRef {
  type?: string;
  name?: string;
}

export function AgentPreview({ name, draft }: MetadataPreviewProps) {
  const d = draft as Record<string, unknown>;
  const agentName = String(d.name ?? name ?? '');
  const label = String(d.label ?? agentName);
  const role = String(d.role ?? '');
  const avatar = (d.avatar as string | undefined) || undefined;
  const instructions = String(d.instructions ?? '');
  const active = d.active !== false;
  const model = (d.model ?? {}) as ModelConfig;
  const skills: string[] = Array.isArray(d.skills) ? (d.skills as string[]) : [];
  const tools: ToolRef[] = Array.isArray(d.tools) ? (d.tools as ToolRef[]) : [];
  const knowledge = d.knowledge as Record<string, unknown> | undefined;
  const planning = d.planning as Record<string, unknown> | undefined;
  const memory = d.memory as Record<string, unknown> | undefined;
  const guardrails = d.guardrails as Record<string, unknown> | undefined;
  const permissions = Array.isArray(d.permissions) ? (d.permissions as string[]) : [];

  if (!agentName && !instructions && skills.length === 0 && tools.length === 0) {
    return (
      <PreviewShell hint="agent">
        <PreviewMessage>Fill in label, role, and instructions in the Form tab to see the agent preview.</PreviewMessage>
      </PreviewShell>
    );
  }

  const chatUrl = agentName ? `/console/ai/agents/${encodeURIComponent(agentName)}/chat` : null;

  return (
    <PreviewShell
      hint="agent"
      toolbar={
        chatUrl && (
          <a
            href={chatUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            title="Open the saved version of this agent in a new chat"
          >
            Try in chat <ExternalLink className="h-3 w-3" />
          </a>
        )
      }
    >
      <PreviewErrorBoundary>
        <div className="grid lg:grid-cols-[1fr_240px] gap-0">
          <div className="p-3 space-y-3 min-w-0">
            {/* Persona header */}
            <div className="rounded border bg-muted/30 p-3 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-background border flex items-center justify-center shrink-0 overflow-hidden">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Bot className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{agentName}</span>
                </div>
                {role && <div className="text-xs text-muted-foreground mt-0.5">{role}</div>}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <Pill icon={active ? Eye : EyeOff} label={active ? 'Active' : 'Disabled'} tone={active ? 'green' : 'gray'} />
                  {model.provider && <Pill icon={Sparkles} label={`${model.provider}${model.model ? ` · ${model.model}` : ''}`} mono />}
                  {model.temperature != null && <Pill icon={Gauge} label={`temp ${model.temperature}`} />}
                  {model.maxTokens != null && <Pill label={`max ${model.maxTokens}t`} />}
                </div>
              </div>
            </div>

            {/* System prompt */}
            <Section title="Instructions" icon={ScrollText}>
              {instructions ? (
                <pre className="m-0 rounded border bg-background p-2.5 text-xs whitespace-pre-wrap font-mono max-h-[40vh] overflow-auto">
                  {instructions}
                </pre>
              ) : (
                <Empty>No system prompt set yet.</Empty>
              )}
            </Section>

            {/* Capabilities */}
            <Section title="Capabilities" icon={Wrench}>
              <div className="space-y-2">
                <ChipList
                  label="Skills"
                  emptyHint="Attach skills (preferred)"
                  items={skills.map((s) => ({ key: s, label: s }))}
                  icon={Sparkles}
                  tone="violet"
                  mono
                />
                <ChipList
                  label="Tools"
                  emptyHint="No direct tools (skills can provide them)"
                  items={tools.map((t, i) => ({ key: `${t.type ?? ''}:${t.name ?? i}`, label: t.name ?? String(t), hint: t.type }))}
                  icon={Wrench}
                  tone="blue"
                  mono
                />
              </div>
            </Section>

            {/* Knowledge */}
            {knowledge && Object.keys(knowledge).length > 0 && (
              <Section title="Knowledge (RAG)" icon={Database}>
                <KnowledgeSummary knowledge={knowledge} />
              </Section>
            )}
          </div>

          {/* Side rail: planning / memory / guardrails / permissions */}
          <div className="border-l bg-muted/20 p-3 text-xs space-y-3">
            {planning && Object.keys(planning).length > 0 && (
              <RailBlock icon={BrainCircuit} title="Planning">
                <KeyVals data={planning} keys={['maxIterations']} />
              </RailBlock>
            )}
            {memory && Object.keys(memory).length > 0 && (
              <RailBlock icon={Activity} title="Memory">
                <KeyVals
                  data={{
                    'short.maxMessages': (memory.shortTerm as any)?.maxMessages,
                    'long.enabled': (memory.longTerm as any)?.enabled,
                    'long.store': (memory.longTerm as any)?.store,
                  }}
                  keys={['short.maxMessages', 'long.enabled', 'long.store']}
                />
              </RailBlock>
            )}
            {guardrails && Object.keys(guardrails).length > 0 && (
              <RailBlock icon={Shield} title="Guardrails">
                <KeyVals data={guardrails as Record<string, unknown>} keys={Object.keys(guardrails).slice(0, 6)} />
              </RailBlock>
            )}
            {permissions.length > 0 && (
              <RailBlock icon={Lock} title="Permissions">
                <ul className="space-y-0.5">
                  {permissions.map((p) => <li key={p} className="font-mono">{p}</li>)}
                </ul>
              </RailBlock>
            )}
            {!planning && !memory && !guardrails && permissions.length === 0 && (
              <div className="text-muted-foreground italic">Defaults in use.</div>
            )}
          </div>
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function KnowledgeSummary({ knowledge }: { knowledge: Record<string, unknown> }) {
  const sources = Array.isArray(knowledge.sources) ? (knowledge.sources as unknown[]) : [];
  const indexes = Array.isArray(knowledge.indexes) ? (knowledge.indexes as unknown[]) : [];
  const items = [...sources, ...indexes];
  if (items.length === 0) {
    const keys = Object.keys(knowledge);
    return (
      <div className="text-xs text-muted-foreground font-mono">
        {keys.length ? keys.join(', ') : 'configured'}
      </div>
    );
  }
  return (
    <ul className="rounded border bg-background divide-y text-xs">
      {items.map((s, i) => {
        const obj = (s ?? {}) as Record<string, unknown>;
        const id = (obj.id ?? obj.name ?? `source ${i + 1}`) as string;
        const kind = (obj.type ?? obj.kind ?? '') as string;
        return (
          <li key={i} className="flex items-center gap-2 px-2.5 py-1.5">
            <Database className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono">{String(id)}</span>
            {kind && <span className="text-[10px] uppercase text-muted-foreground">{kind}</span>}
          </li>
        );
      })}
    </ul>
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

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic">{children}</div>;
}

/**
 * Tone presets for capability chips — keep skills and tools visually
 * distinct at a glance. Full Tailwind class strings (JIT) with light +
 * dark variants.
 */
const CHIP_TONE = {
  violet: {
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
    icon: 'text-violet-500 dark:text-violet-400',
  },
  blue: {
    chip: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
    icon: 'text-blue-500 dark:text-blue-400',
  },
} as const;

function ChipList({
  label,
  emptyHint,
  items,
  icon: Icon,
  tone,
  mono = false,
}: {
  label: string;
  emptyHint: string;
  items: Array<{ key: string; label: string; hint?: string }>;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof CHIP_TONE;
  mono?: boolean;
}) {
  const t = tone ? CHIP_TONE[tone] : null;
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">{label}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">{emptyHint}</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((it) => (
            <span
              key={it.key}
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]',
                t ? t.chip : 'bg-background',
                mono && 'font-mono',
              )}
            >
              {Icon && <Icon className={cn('h-3 w-3 shrink-0', t?.icon)} />}
              {it.label}
              {it.hint && <span className="text-[9px] uppercase opacity-70">{it.hint}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RailBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
        <Icon className="h-3 w-3" /> {title}
      </div>
      {children}
    </div>
  );
}

function KeyVals({ data, keys }: { data: Record<string, unknown>; keys: string[] }) {
  const rows = keys
    .map((k) => [k, getPath(data, k)] as const)
    .filter(([, v]) => v !== undefined && v !== null);
  if (rows.length === 0) return <div className="text-muted-foreground italic">—</div>;
  return (
    <dl className="space-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <dt className="text-muted-foreground font-mono truncate">{k}</dt>
          <dd className="font-mono text-right truncate">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
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
