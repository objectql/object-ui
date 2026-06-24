// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ScreenPreview — live design-time preview of a flow `screen` node, rendered
 * exactly as the end user will see it at runtime.
 *
 * It builds a runtime `ScreenSpec` from the node's authored `config` and hands
 * it to the shared {@link ScreenView} — the SAME renderer the runtime
 * FlowRunner uses — so the preview can never drift from runtime (the
 * design↔runtime divergence #1927 set out to kill). `{var}` references in the
 * title/description are interpolated, and `fields` are gated by their
 * `visibleWhen`, against the supplied `variables` (the flow's declared defaults
 * in the inspector, or the live simulated values when paused in the Debug
 * simulator).
 *
 * Homes: the flow node inspector (live-updates as the config is edited) and the
 * Debug simulator's paused-at-screen state.
 */

import * as React from 'react';
import { Button, cn } from '@object-ui/components';
import { useAdapter } from '../../../providers/AdapterProvider';
import { ScreenView, isObjectFormScreen, initialScreenValues, type ScreenSpec } from '../../ScreenView';
import { buildScreenSpec, interpolate, hiddenFieldCount, type ScreenPreviewNode } from './screen-spec';

export type { ScreenPreviewNode } from './screen-spec';

export interface ScreenPreviewProps {
  /** The screen node to preview. */
  node: ScreenPreviewNode;
  /**
   * Variable values for `{var}` interpolation in the title/description AND for
   * evaluating each field's `visibleWhen`. The inspector passes the flow's
   * declared defaults; the simulator passes the live run state at the pause
   * point. Unknown `{var}` refs stay literal, and fields whose `visibleWhen`
   * can't be decided stay visible — the design preview never hides on missing
   * data.
   */
  variables?: Record<string, unknown>;
  className?: string;
}

export function ScreenPreview({ node, variables, className }: ScreenPreviewProps) {
  const adapter = useAdapter();
  const spec = React.useMemo(() => buildScreenSpec(node, variables), [node, variables]);
  const isObjectForm = isObjectFormScreen(spec);
  const title = interpolate(spec.title, variables);
  const description = interpolate(spec.description, variables);
  const hidden = isObjectForm ? 0 : hiddenFieldCount(node, variables);

  // Reset transient input state when the screen's STRUCTURE changes (fields
  // added/removed/retyped/gated, or object-form target/mode); typing survives a
  // label/title-only edit.
  const structKey = isObjectForm
    ? `obj:${spec.objectName}:${spec.mode ?? 'create'}`
    : 'fields:' + spec.fields.map((f) => `${f.name}:${f.type ?? ''}:${f.required ? 1 : 0}`).join('|');

  const empty = !title && !description && !isObjectForm && spec.fields.length === 0 && hidden === 0;

  return (
    <div className={cn('overflow-hidden rounded-md border bg-background', className)}>
      <div className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Preview
      </div>
      <div className="max-h-[60vh] overflow-auto p-4">
        {empty ? (
          <p className="text-sm italic text-muted-foreground">
            Add a title, description, fields, or an object form to preview this screen.
          </p>
        ) : (
          <>
            {title && <h3 className="text-base font-semibold leading-tight">{title}</h3>}
            {description && (
              <p className={cn('whitespace-pre-line text-sm text-muted-foreground', title && 'mt-1')}>{description}</p>
            )}
            <ScreenFormPreview key={structKey} spec={spec} adapter={adapter} />
            {!isObjectForm && hidden > 0 && (
              <p className="mt-3 text-[11px] italic text-muted-foreground">
                {hidden} field{hidden === 1 ? '' : 's'} hidden by {hidden === 1 ? 'its' : 'their'} “visible when”
                {' '}condition{hidden === 1 ? '' : 's'}.
              </p>
            )}
            {!isObjectForm && spec.fields.length > 0 && (
              <div className="mt-4 flex justify-end">
                {/* Non-functional — the preview never resumes a real run. */}
                <Button size="sm" disabled>Submit</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Holds the transient field values so the preview is interactive (the author
 * can type into it) while never persisting anything.
 */
function ScreenFormPreview({ spec, adapter }: { spec: ScreenSpec; adapter: unknown }) {
  const [values, setValues] = React.useState<Record<string, unknown>>(() => initialScreenValues(spec));
  return (
    <ScreenView
      screen={spec}
      values={values}
      onValueChange={(name, v) => setValues((p) => ({ ...p, [name]: v }))}
      dataSource={adapter ?? undefined}
      objectForm={{
        showSubmit: false,
        showCancel: false,
        noDataSourceMessage: 'Connect to a backend to preview this object form.',
      }}
    />
  );
}
