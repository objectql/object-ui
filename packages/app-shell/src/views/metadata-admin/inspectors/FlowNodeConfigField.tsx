// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeConfigField — renders one scalar config control for a flow node,
 * driven by a `FlowConfigField` descriptor. Bridges descriptor "kind" to the
 * shared inspector field primitives and writes back to `node.config[key]`.
 */

import * as React from 'react';
import type { FlowConfigField } from './flow-node-config';
import { t } from '../i18n';
import {
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
} from './_shared';
import { Label } from '@object-ui/components';
import { FlowKeyValueField } from './FlowKeyValueField';
import { FlowStringListField } from './FlowStringListField';
import { FlowObjectListField } from './FlowObjectListField';
import { FlowReferenceField, type FlowReferenceContext } from './FlowReferenceField';
import { validateExpressionClient } from './expression-validate';
import { VariableTextInput } from './VariableTextInput';
import type { ScopeGroup } from './useFlowScope';
import { findUnknownRefs, scopeRoots, describeUnknownRefs } from './flow-ref-check';

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
}

export function FlowNodeConfigField({ field, value, onCommit, disabled, locale, context, scopeGroups }: FlowNodeConfigFieldProps) {
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
            context={context}
            scopeGroups={scopeGroups}
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
        return (
          <InspectorSelectField
            label={field.label}
            value={value != null ? String(value) : ''}
            options={field.options ?? []}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
          />
        );
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
  // for expression fields (a genuine template uses single-brace `{var}` legally).
  const exprIssue =
    field.kind === 'expression' ? validateExpressionClient('predicate', value) : null;

  // #1934 — pair the picker with a gentle, scope-aware "unknown reference"
  // warning: CEL for expression fields, `{…}` holes for template fields. Skipped
  // for free-form code (refMode 'expression' on a textarea, e.g. a script body)
  // and when scope is unknown. The brace error above takes precedence.
  const scopeRole: 'predicate' | 'template' | null =
    field.kind === 'expression'
      ? 'predicate'
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
          {describeUnknownRefs(unknownRefs)}
        </p>
      )}
      {field.help && !exprIssue && unknownRefs.length === 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">{field.help}</p>
      )}
    </div>
  );
}
