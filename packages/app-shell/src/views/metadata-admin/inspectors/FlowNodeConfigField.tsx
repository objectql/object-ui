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
  InspectorTextField,
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
} from './_shared';
import { Label } from '@object-ui/components';
import { FlowKeyValueField } from './FlowKeyValueField';
import { FlowStringListField } from './FlowStringListField';
import { FlowObjectListField } from './FlowObjectListField';
import { FlowReferenceField, type FlowReferenceContext } from './FlowReferenceField';

export interface FlowNodeConfigFieldProps {
  field: FlowConfigField;
  value: unknown;
  onCommit: (value: unknown) => void;
  disabled?: boolean;
  locale?: string;
  /** Draft + node context so `reference` fields can resolve their options. */
  context?: FlowReferenceContext;
}

export function FlowNodeConfigField({ field, value, onCommit, disabled, locale, context }: FlowNodeConfigFieldProps) {
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
            <textarea
              value={value != null ? String(value) : ''}
              onChange={(e) => onCommit(e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              rows={4}
              className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
            />
          </div>
        );
      case 'expression':
      case 'text':
      default:
        return (
          <InspectorTextField
            label={field.label}
            value={value != null ? String(value) : ''}
            placeholder={field.placeholder}
            onCommit={(v) => onCommit(v)}
            disabled={disabled}
            mono={field.kind === 'expression'}
          />
        );
    }
  })();

  return (
    <div className="space-y-1">
      {control}
      {field.help && <p className="text-[11px] leading-snug text-muted-foreground">{field.help}</p>}
    </div>
  );
}
