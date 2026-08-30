// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeConfigField — renders one scalar config control for a flow node,
 * driven by a `FlowConfigField` descriptor. Bridges descriptor "kind" to the
 * shared inspector field primitives and writes back to `node.config[key]`.
 */

import * as React from 'react';
import type { FlowConfigField, InactiveRetainedKind } from './flow-node-config.js';
import { t } from '../i18n.js';
import {
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
} from './_shared.js';
import { Button, Label } from '@object-ui/components';
import { FlowKeyValueField } from './FlowKeyValueField.js';
import { FlowStringListField } from './FlowStringListField.js';
import { FlowObjectListField } from './FlowObjectListField.js';
import { FlowReferenceField, type FlowReferenceContext } from './FlowReferenceField.js';
import { validateExpressionClient } from './expression-validate.js';
import { VariableTextInput } from './VariableTextInput.js';
import type { ScopeGroup } from './useFlowScope.js';
import type { TriggerScope } from './flow-scope.js';
import { ConditionBuilder } from './ConditionBuilder.js';
import { findUnknownRefs, scopeRoots, describeUnknownRefs } from './flow-ref-check.js';

/**
 * The context subjects a flow trigger condition binds — none (objectui#6226).
 *
 * ConditionBuilder's default context list is `record.id` / `user.*` / `org.*`,
 * which is right for its five record-scoped consumers and wrong here: at a
 * record-trigger gate the evaluation context is the changed record FLATTENED to
 * top level plus `previous`, and `record` is exactly the root `flow-scope.ts`
 * withholds on the start node. Inheriting the default would make this editor
 * emit `record.id` — the one spelling the `findUnknownRefs` note rendered a few
 * lines below, reading the SAME scope, flags as out of scope. One panel
 * contradicting its own generated output.
 *
 * So the vocabulary offered here is exactly what `TriggerScope` declares: the
 * trigger record's fields (bare) and `previous` / `previous.FIELD`. Roots this
 * surface has not been shown to bind are not guessed into the list; an author
 * who needs one still has the raw CEL escape hatch.
 */
const FLOW_TRIGGER_CONTEXT_SUBJECTS: ReadonlyArray<{ value: string; label?: string }> = [];

export interface FlowNodeConfigFieldProps {
  field: FlowConfigField;
  value: unknown;
  onCommit: (value: unknown) => void;
  disabled?: boolean;
  locale?: string;
  /** Draft + node context so `reference` fields can resolve their options. */
  context?: FlowReferenceContext;
  /** In-scope variable references for the data-picker (#1934). */
  scopeGroups?: ScopeGroup[];
  /** #3447: approval-expression picker groups (current/trigger/vars roots). */
  approvalScopeGroups?: ScopeGroup[];
  /**
   * The trigger record's declared subject vocabulary at this node, when one is
   * in scope (objectui#6226) — supplied by `useFlowScope`, resolved by
   * `flow-scope.ts`. Required before a `conditionBuilder` field may render the
   * row builder: the vocabulary is declared by the site, never inferred from
   * the value.
   */
  triggerScope?: TriggerScope;
  /**
   * objectui#6499 — set when this field is on screen ONLY because it holds a
   * stored value its `showWhen` controller does not currently admit. Supplied
   * by the host inspector, which owns the node and the sibling field set (this
   * component sees neither), and computed by `inactiveRetainedKind`.
   *
   * `undefined`/`null` is the normal case and renders exactly as before, so a
   * caller that does not pass it is unaffected.
   */
  inactiveRetained?: InactiveRetainedKind | null;
  /**
   * Clears the retained value — an ordinary field commit of `undefined`, the
   * same write the author would make by emptying the control by hand. The
   * ruling keeps hidden values by default; this is how the author discards one
   * DELIBERATELY. Omit to render the notice without the button.
   */
  onClearInactive?: () => void;
}

export function FlowNodeConfigField({ field, value, onCommit, disabled, locale, context, scopeGroups, approvalScopeGroups, triggerScope, inactiveRetained, onClearInactive }: FlowNodeConfigFieldProps) {
  const refMode: 'expression' | 'template' =
    field.refMode ?? (field.kind === 'expression' ? 'expression' : 'template');
  // objectui#6226 — the row-based condition builder, on the fields that opted in
  // AND at a site that declares the vocabulary. All three conjuncts are load
  // bearing: `conditionBuilder` keeps `expression` from meaning "predicate"
  // everywhere it appears; `triggerScope` is the declared vocabulary, absent on
  // a trigger that binds no record; `refMode !== 'template'` keeps an
  // `interpolate()` field (a loop `collection`) out even if one ever opts in.
  const asConditionBuilder =
    field.kind === 'expression' && !!field.conditionBuilder && !!triggerScope && refMode !== 'template';
  const control = (() => {
    if (asConditionBuilder && triggerScope) {
      return (
        <ConditionBuilder
          label={field.label}
          value={value != null ? String(value) : ''}
          onCommit={(cel) => onCommit(cel)}
          objectName={triggerScope.objectName}
          disabled={disabled}
          subjects={{
            fieldPrefix: triggerScope.fieldPrefix,
            includePrevious: triggerScope.includePrevious,
            context: FLOW_TRIGGER_CONTEXT_SUBJECTS,
          }}
        />
      );
    }
    switch (field.kind) {
      case 'reference':
        return (
          <FlowReferenceField
            field={field}
            value={value}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
            context={context}
          />
        );
      case 'keyValue':
        return (
          <FlowKeyValueField
            label={field.label}
            value={value}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
            addLabel={t('engine.inspector.flowNode.kv.add', locale)}
            keyLabel={t('engine.inspector.flowNode.kv.key', locale)}
            valueLabel={t('engine.inspector.flowNode.kv.value', locale)}
            removeLabel={t('engine.inspector.flowNode.kv.remove', locale)}
            emptyLabel={t('engine.inspector.flowNode.kv.empty', locale)}
            scopeGroups={scopeGroups}
          />
        );
      case 'stringList':
        return (
          <FlowStringListField
            label={field.label}
            value={value}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
            addLabel={t('engine.inspector.flowNode.list.add', locale)}
            itemLabel={t('engine.inspector.flowNode.list.item', locale)}
            removeLabel={t('engine.inspector.flowNode.list.remove', locale)}
            emptyLabel={t('engine.inspector.flowNode.list.empty', locale)}
          />
        );
      case 'numberList':
        return (
          <FlowStringListField
            label={field.label}
            // Stored as number[]; the list editor works in strings, so show each
            // number as text and coerce back to number[] on commit (dropping
            // blanks / non-numbers). Keeps the backend contract strict (number[])
            // rather than persisting string values the schema would reject.
            value={Array.isArray(value) ? (value as unknown[]).map((n) => String(n)) : value}
            onCommit={(v) => {
              if (v == null) return onCommit(undefined);
              const nums = v.map((s) => Number(String(s).trim())).filter((n) => Number.isFinite(n));
              onCommit(nums.length ? nums : undefined);
            }}
            disabled={disabled}
            addLabel={t('engine.inspector.flowNode.list.add', locale)}
            itemLabel={t('engine.inspector.flowNode.list.item', locale)}
            removeLabel={t('engine.inspector.flowNode.list.remove', locale)}
            emptyLabel={t('engine.inspector.flowNode.list.empty', locale)}
          />
        );
      case 'objectList':
        return (
          <FlowObjectListField
            label={field.label}
            columns={field.columns ?? []}
            value={value}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
            addLabel={t('engine.inspector.flowNode.list.add', locale)}
            removeLabel={t('engine.inspector.flowNode.list.remove', locale)}
            emptyLabel={t('engine.inspector.flowNode.list.empty', locale)}
            itemLabel={t('engine.inspector.flowNode.list.item', locale)}
            context={context}
            scopeGroups={scopeGroups}
            approvalScopeGroups={approvalScopeGroups}
          />
        );
      case 'number':
        return (
          <InspectorNumberField
            label={field.label}
            value={typeof value === 'number' ? value : value != null && value !== '' ? Number(value) : undefined}
            placeholder={field.placeholder}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
          />
        );
      case 'boolean':
        return (
          <InspectorCheckboxField
            label={field.label}
            value={value === true}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
          />
        );
      case 'select':
        return (() => {
          const current = value != null ? String(value) : '';
          const opts = field.options ?? [];
          // A stored value dropped from the options (e.g. a script node's
          // legacy `code` / `sms` actionType, framework#4278) must still
          // render, or editing a legacy node would silently blank it. Surface
          // it as selectable but flag it — it is not offered to fresh nodes.
          // Same rule as FlowObjectListField's select cells (ADR-0090 D3).
          const shown =
            current && !opts.some((o) => o.value === current)
              ? [...opts, { value: current, label: `${current} (deprecated)` }]
              : opts;
          return (
            <InspectorSelectField
              label={field.label}
              value={current}
              options={shown}
              onCommit={(v) => onCommit(v)}
              disabled={disabled}
            />
          );
        })();
      case 'textarea':
        return (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            <VariableTextInput
              multiline
              rows={4}
              mode={refMode}
              value={value != null ? String(value) : ''}
              onValueChange={(v) => onCommit(v)}
              groups={scopeGroups ?? []}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          </div>
        );
      case 'expression':
      case 'text':
      default:
        return (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            <VariableTextInput
              mode={refMode}
              mono={field.kind === 'expression'}
              value={value != null ? String(value) : ''}
              onValueChange={(v) => onCommit(v)}
              groups={scopeGroups ?? []}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          </div>
        );
    }
  })();

  // ADR-0032 — surface a malformed condition (e.g. the `{record.x}` brace-in-CEL
  // mistake) inline, with the same corrective message the build/agent emit. Only
  // for expression fields in a *predicate* mode — an expression field flagged
  // `refMode: 'template'` (e.g. a loop/map collection authored as `{leadList}`)
  // is an `interpolate()` single-brace template where `{var}` is legal, so the
  // CEL brace-trap must be gated off or it false-positives on every `{…}`.
  const isTemplate = refMode === 'template';
  const exprIssue =
    field.kind === 'expression' && !isTemplate ? validateExpressionClient('predicate', value) : null;

  // #1934 — pair the picker with a gentle, scope-aware "unknown reference"
  // warning: CEL for predicate expression fields, `{…}` holes for template
  // fields (including an expression field in template mode). Skipped for
  // free-form code (refMode 'expression' on a textarea, e.g. a script body) and
  // when scope is unknown. The brace error above takes precedence.
  const scopeRole: 'predicate' | 'template' | null =
    field.kind === 'expression'
      ? isTemplate
        ? 'template'
        : 'predicate'
      : refMode === 'template' && (field.kind === 'text' || field.kind === 'textarea')
        ? 'template'
        : null;
  const unknownRefs =
    !exprIssue && scopeRole && scopeGroups && scopeGroups.length > 0
      ? findUnknownRefs(value, scopeRole, scopeRoots(scopeGroups.flatMap((g) => g.refs)))
      : [];

  return (
    <div className="space-y-1">
      {control}
      {/*
        objectui#6499 — the "inactive values retained" affordance. Rendered
        ABOVE the expression/scope notes and independently of them: those judge
        the value's CONTENT, this one says the value is not in effect at all,
        and an author who cannot see the second will misread the first.
        Deliberately not a `disabled` control — the value is still editable, it
        just is not live, and greying it out would hide the very text the
        ruling asks the author to be able to read and act on.
      */}
      {inactiveRetained && (
        <div
          className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5"
          role="note"
          data-testid="inactive-retained"
          data-inactive-retained={inactiveRetained}
        >
          <p className="flex-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
            {t(
              inactiveRetained === 'no-controller'
                ? 'engine.inspector.flowNode.inactiveRetainedOrphan'
                : 'engine.inspector.flowNode.inactiveRetained',
              locale,
            )}
          </p>
          {onClearInactive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-2 text-[11px] text-amber-700 dark:text-amber-400"
              onClick={onClearInactive}
              disabled={disabled}
            >
              {t('engine.inspector.flowNode.inactiveRetainedClear', locale)}
            </Button>
          )}
        </div>
      )}
      {exprIssue && (
        <p className="text-[11px] leading-snug text-destructive" role="alert">
          {exprIssue.message}
        </p>
      )}
      {!exprIssue && unknownRefs.length > 0 && (
        <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400" role="note">
          {describeUnknownRefs(unknownRefs, locale)}
        </p>
      )}
      {field.help && !exprIssue && unknownRefs.length === 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">{field.help}</p>
      )}
    </div>
  );
}
