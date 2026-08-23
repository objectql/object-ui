/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:path` — Salesforce Lightning Path-style stepper. Reads the value
 * of `schema.statusField` from the bound record and highlights the matching
 * stage in `schema.stages[]`. Stages preceding the current one render as
 * completed (with a check); the current renders as active; subsequent
 * stages render as upcoming.
 *
 * ── This surface is a READOUT, and it must look like one (objectui#5768) ──
 *
 * It used to draw each stage as a filled, shadowed, equal-width pill — the
 * exact shape of a segmented button group — while carrying no handler, no
 * cursor and no tab stop. Measured in a browser on a shipped build: the
 * segments were `role="listitem"` with `cursor: auto` and `tabindex` null,
 * and a full pointer sequence (pointerdown → mousedown → pointerup →
 * mouseup → click) left the record's status untouched. Users spent clicks
 * on it before concluding it was decoration.
 *
 * There is no write path to spend those clicks on: this renderer's only
 * channel is `useRecordContext()`, whose value (`RecordContextValue` in
 * `@object-ui/react`) exposes `data` / `refresh` / `headerSystemActions` /
 * `onToggleFavorite` and NO record-field mutation. Editing goes through
 * `record:details`' `<InlineEditProvider>` + `<InlineEditSaveBar>`
 * (`dataSource.update(..., { ifMatch })`) or an action via
 * `useActionEngine`; neither reaches here. Click-to-advance is a separate,
 * approved-on-its-own-appetite feature — until it exists, the pixels must
 * not promise it.
 *
 * So the presentation below is a PROGRESS RAIL: a thin decorative indicator
 * per stage with the label as plain text beneath it, which is the same
 * vocabulary app-shell's approval step readout already uses
 * (`RecordApprovalsPanel` — marker, rail, bare label, weight for "current",
 * never a filled surface). Deliberately absent: per-stage filled pills,
 * `shadow`, `ring`, bordered chips, and equal-width tap targets.
 *
 * The DOM attributes below carry state that used to live only in colour, so
 * the classification stays assertable without reading CSS (the test DOM
 * resolves no Tailwind):
 *   • `data-stage-state`     — `completed` | `current` | `upcoming`
 *   • `data-stage-terminal`  — `won` | `lost`, when a stage is classified
 *   • `data-stage-rail`      — marks the decorative indicator as an element
 *                              SEPARATE from the label. A rail has one; a
 *                              pill, which is its own label's surface, cannot.
 */

import React from 'react';
import { useRecordContext, useSafeFieldLabel } from '@object-ui/react';
import type { RecordPathComponentProps } from '@object-ui/types';
import { cn } from '@object-ui/components';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

type StageState = 'completed' | 'current' | 'upcoming';

export interface RecordPathRendererProps {
  schema?: RecordPathComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordPathRenderer: React.FC<RecordPathRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { translateOptions } = useSafeFieldLabel();
  const { designer } = splitDesigner(props);

  const rawStages: Array<{ value: any; label: string; terminal?: 'won' | 'lost' }> = Array.isArray(schema.stages)
    ? (schema.stages as any)
    : [];
  const statusField: string | undefined = schema.statusField;
  // Localize picklist labels when an i18n provider is mounted and the
  // record context knows which object owns the field. Falls back to the
  // schema's own labels (already English in synth, possibly authored in
  // any language for full Lightning pages) when no translation is found.
  const stages: Array<{ value: any; label: string; terminal?: 'won' | 'lost' }> = React.useMemo(() => {
    if (rawStages.length === 0 || !statusField || !ctx?.objectName) return rawStages;
    const translated = translateOptions(ctx.objectName, statusField, rawStages as any);
    if (Array.isArray(translated) && translated.length === rawStages.length) {
      return rawStages.map((s, i) => ({ ...s, label: (translated as any)[i]?.label ?? s.label }));
    }
    return rawStages;
  }, [rawStages, statusField, ctx?.objectName, translateOptions]);
  const current = statusField && ctx?.data ? (ctx.data as any)[statusField] : undefined;

  // Classify each stage. Honor explicit `terminal` from the schema first;
  // fall back to a heuristic so CRM examples / Salesforce-style picklists
  // ("closed_won", "closed_lost", "失败", "流失") get the right treatment
  // without requiring authors to migrate their stage configs.
  const LOST_TOKENS = /(^|[_-\s])(closed_)?(lost|failed?|cancell?ed|失败|流失|丢单|败)([_-\s]|$)/i;
  const WON_TOKENS = /(^|[_-\s])(closed_)?(won|success|成交|赢|完成)([_-\s]|$)/i;
  const classify = (s: { value: any; label?: string; terminal?: 'won' | 'lost' }): 'won' | 'lost' | undefined => {
    if (s.terminal) return s.terminal;
    const probe = `${String(s.value ?? '')} ${String(s.label ?? '')}`;
    if (LOST_TOKENS.test(probe)) return 'lost';
    if (WON_TOKENS.test(probe)) return 'won';
    return undefined;
  };
  const stageKinds = stages.map(classify);
  // Find the index of the FIRST lost-class stage so we can render it
  // (and any subsequent lost terminals) as a visually separated alt
  // group. Won-class stages stay inside the forward path — they're the
  // successful terminus.
  const firstLostIdx = stageKinds.findIndex((k) => k === 'lost');
  const forwardStages = firstLostIdx === -1 ? stages : stages.slice(0, firstLostIdx);
  const lostStages = firstLostIdx === -1 ? [] : stages.slice(firstLostIdx);
  const forwardKinds = firstLostIdx === -1 ? stageKinds : stageKinds.slice(0, firstLostIdx);

  let currentIdx = stages.findIndex((s) => s.value === current);
  if (currentIdx < 0) currentIdx = -1;
  const currentInLost = firstLostIdx !== -1 && currentIdx >= firstLostIdx;

  if (stages.length === 0) {
    return (
      <div className={className} {...designer}>
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:path — no stages configured
        </div>
      </div>
    );
  }

  // The rail: a 6px track segment. Completed reads as travelled (emerald,
  // matching the approvals readout's `done`), current as where the record
  // sits (accent), upcoming as untravelled track. A `lost` terminal tints
  // destructive; an unreached `won` terminus stays a faint emerald so the
  // goal is legible without being a surface you could press.
  const railClass = (state: StageState, terminal?: 'won' | 'lost') =>
    cn(
      'h-1.5 w-full rounded-full',
      terminal === 'lost' && (state === 'current' ? 'bg-destructive' : 'bg-destructive/25'),
      terminal !== 'lost' && state === 'current' && 'bg-primary',
      terminal !== 'lost' && state === 'completed' && 'bg-emerald-500',
      terminal !== 'lost' && state === 'upcoming' && (terminal === 'won' ? 'bg-emerald-500/30' : 'bg-muted'),
    );

  // Emphasis by TYPE WEIGHT, not by a filled box — the one cue a readout can
  // spend without implying it can be pressed.
  const labelClass = (state: StageState, terminal?: 'won' | 'lost') =>
    cn(
      'block min-w-0 text-xs',
      state === 'current' && (terminal === 'lost' ? 'font-semibold text-destructive' : 'font-semibold text-foreground'),
      state === 'completed' && 'font-normal text-muted-foreground',
      state === 'upcoming' && 'font-normal text-muted-foreground',
    );

  const renderStage = (o: {
    key: string;
    stage: { label: string };
    state: StageState;
    terminal?: 'won' | 'lost';
    className?: string;
    labelClassName?: string;
  }) => (
    <div
      key={o.key}
      role="listitem"
      data-stage-state={o.state}
      data-stage-terminal={o.terminal}
      aria-current={o.state === 'current' ? 'step' : undefined}
      className={cn('flex flex-col gap-1.5', o.className)}
    >
      <span aria-hidden="true" data-stage-rail="" className={railClass(o.state, o.terminal)} />
      <span className={cn(labelClass(o.state, o.terminal), o.labelClassName)}>
        {o.terminal === 'lost' && <span aria-hidden="true" className="mr-1 opacity-70">✗</span>}
        {o.terminal !== 'lost' && o.state === 'completed' && (
          <span aria-hidden="true" className="mr-1 text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
        )}
        {o.stage.label}
      </span>
    </div>
  );

  const last = forwardStages.length - 1;

  return (
    <div className={cn('w-full', className)} {...designer}>
      {/* Desktop: forward rail → optional lost-alt group */}
      <div
        className="hidden sm:flex w-full items-start gap-2"
        role="list"
        aria-label={(schema.aria as any)?.label || 'Record path'}
      >
        <div className="flex flex-1 items-start gap-1.5">
          {forwardStages.map((stage, idx) => {
            const isCompleted = !currentInLost && currentIdx >= 0 && idx < currentIdx;
            const isCurrent = !currentInLost && idx === currentIdx;
            const isWonTerminus = forwardKinds[idx] === 'won' && idx === last;
            return renderStage({
              key: `${stage.value}-${idx}`,
              stage,
              state: isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming',
              terminal: isWonTerminus ? 'won' : undefined,
              className: 'flex-1 min-w-0',
              labelClassName: 'text-center truncate',
            });
          })}
        </div>
        {lostStages.length > 0 && (
          // Separated alt-terminus group — a gap and a divider, so it does not
          // read as "step N+1" in the forward path.
          <div className="flex items-start gap-1.5 pl-2 border-l border-border/40" aria-label="Alternative terminal stages">
            {lostStages.map((stage, lIdx) => {
              const absIdx = firstLostIdx + lIdx;
              return renderStage({
                key: `${stage.value}-lost-${lIdx}`,
                stage,
                state: absIdx === currentIdx ? 'current' : 'upcoming',
                terminal: 'lost',
                className: 'shrink-0',
                labelClassName: 'text-center whitespace-nowrap',
              });
            })}
          </div>
        )}
      </div>

      {/* Mobile: horizontally scrollable rail row — same treatment, no chips */}
      <div
        className="flex sm:hidden w-full items-start gap-2 overflow-x-auto pb-1 -mx-1 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label={(schema.aria as any)?.label || 'Record path'}
      >
        {stages.map((stage, idx) => {
          const kind = stageKinds[idx];
          const isLost = kind === 'lost';
          const isCompleted = !isLost && !currentInLost && currentIdx >= 0 && idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return renderStage({
            key: `${stage.value}-${idx}-m`,
            stage,
            state: isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming',
            terminal: kind,
            className: 'shrink-0',
            labelClassName: 'whitespace-nowrap',
          });
        })}
      </div>
    </div>
  );
};

export default RecordPathRenderer;
