// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeConfigField — renders one scalar config control for a flow node,
 * driven by a `FlowConfigField` descriptor. Bridges descriptor "kind" to the
 * shared inspector field primitives and writes back to `node.config[key]`.
 */

import * as React from 'react';
import type { FlowConfigField } from './flow-node-config.js';
import { t } from '../i18n.js';
import {
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
} from './_shared.js';
import { Label } from '@object-ui/components';
import { FlowKeyValueField } from './FlowKeyValueField.js';
import { FlowStringListField } from './FlowStringListField.js';
import { FlowObjectListField } from './FlowObjectListField.js';
import { FlowReferenceField, type FlowReferenceContext } from './FlowReferenceField.js';
import { validateExpressionClient } from './expression-validate.js';
import { VariableTextInput } from './VariableTextInput.js';
import type { ScopeGroup } from './useFlowScope.js';
import { findUnknownRefs, scopeRoots, describeUnknownRefs } from './flow-ref-check.js';

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
}

export function FlowNodeConfigField({ field, value, onCommit, disabled, locale, context, scopeGroups, approvalScopeGroups }: FlowNodeConfigFieldProps) {
  const refMode: 'expression' | 'template' =
    field.refMode ?? (field.kind === 'expression' ? 'expression' : 'template');
  const control = (() => {
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
