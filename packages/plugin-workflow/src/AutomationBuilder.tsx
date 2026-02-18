/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Label, Badge, Separator, Switch,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@object-ui/components';
import { Zap, Plus, Trash2, Settings, Clock, Mail, Bell, Globe, FileEdit } from 'lucide-react';

export interface TriggerConfig {
  type: 'record_created' | 'record_updated' | 'record_deleted' | 'field_changed' | 'scheduled';
  objectName?: string;
  fieldName?: string;
  schedule?: string;
  condition?: string;
  conditionField?: string;
  conditionOperator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  conditionValue?: string;
}

export interface ActionConfig {
  type: 'send_email' | 'update_field' | 'create_record' | 'delete_record' | 'webhook' | 'notification';
  params: Record<string, any>;
}

export interface AutomationDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: TriggerConfig;
  actions: ActionConfig[];
  /** Execution mode: 'sequential' runs actions in order, 'parallel' runs all simultaneously. @default 'sequential' */
  executionMode?: 'sequential' | 'parallel';
  createdAt: string;
  lastRunAt?: string;
}

export interface AutomationBuilderProps {
  automation?: AutomationDefinition;
  objects?: Array<{ name: string; label: string; fields?: Record<string, any> }>;
  onSave?: (automation: AutomationDefinition) => void;
  onCancel?: () => void;
  className?: string;
}

const TRIGGER_LABELS: Record<TriggerConfig['type'], string> = {
  record_created: 'Record Created', record_updated: 'Record Updated',
  record_deleted: 'Record Deleted', field_changed: 'Field Changed', scheduled: 'Scheduled',
};

const ACTION_LABELS: Record<ActionConfig['type'], string> = {
  send_email: 'Send Email', update_field: 'Update Field', create_record: 'Create Record',
  delete_record: 'Delete Record', webhook: 'Webhook', notification: 'Notification',
};

const ACTION_ICONS: Record<ActionConfig['type'], React.ReactNode> = {
  send_email: <Mail className="h-4 w-4" />, update_field: <FileEdit className="h-4 w-4" />,
  create_record: <Plus className="h-4 w-4" />, delete_record: <Trash2 className="h-4 w-4" />,
  webhook: <Globe className="h-4 w-4" />, notification: <Bell className="h-4 w-4" />,
};

const CONDITION_OPERATORS: Record<NonNullable<TriggerConfig['conditionOperator']>, string> = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  contains: 'Contains',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
};

const defaultAutomation = (): AutomationDefinition => ({
  id: `auto-${Date.now()}`, name: '', description: '', enabled: true,
  trigger: { type: 'record_created' }, actions: [], createdAt: new Date().toISOString(),
});

/** Helper to render a labelled input for action params */
const ParamInput: React.FC<{
  label: string; value: string; placeholder: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <Input value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

/**
 * AutomationBuilder - Trigger-Action pipeline configuration UI
 * Lets users configure automations with trigger selection, action configuration,
 * and metadata (name, description, enable/disable).
 */
export const AutomationBuilder: React.FC<AutomationBuilderProps> = ({
  automation: initial, objects = [], onSave, onCancel, className,
}) => {
  const [automation, setAutomation] = useState<AutomationDefinition>(initial ?? defaultAutomation());

  const updateTrigger = useCallback((updates: Partial<TriggerConfig>) => {
    setAutomation(prev => ({ ...prev, trigger: { ...prev.trigger, ...updates } }));
  }, []);

  const addAction = useCallback(() => {
    setAutomation(prev => ({ ...prev, actions: [...prev.actions, { type: 'send_email', params: {} }] }));
  }, []);

  const updateAction = useCallback((index: number, updates: Partial<ActionConfig>) => {
    setAutomation(prev => ({ ...prev, actions: prev.actions.map((a, i) => (i === index ? { ...a, ...updates } : a)) }));
  }, []);

  const removeAction = useCallback((index: number) => {
    setAutomation(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }));
  }, []);

  const needsObject = automation.trigger.type !== 'scheduled';
  const needsField = automation.trigger.type === 'field_changed';
  const isScheduled = automation.trigger.type === 'scheduled';
  const selectedObjectFields = objects.find(o => o.name === automation.trigger.objectName)?.fields;

  const renderActionParams = (action: ActionConfig, idx: number) => {
    const setParam = (key: string, value: string) =>
      updateAction(idx, { params: { ...action.params, [key]: value } });
    switch (action.type) {
      case 'send_email':
        return (<>
          <ParamInput label="To" value={action.params.to ?? ''} placeholder="Recipient email" onChange={v => setParam('to', v)} />
          <ParamInput label="Subject" value={action.params.subject ?? ''} placeholder="Email subject" onChange={v => setParam('subject', v)} />
        </>);
      case 'webhook':
        return <ParamInput label="URL" value={action.params.url ?? ''} placeholder="https://..." onChange={v => setParam('url', v)} />;
      case 'notification':
        return <ParamInput label="Message" value={action.params.message ?? ''} placeholder="Notification message" onChange={v => setParam('message', v)} />;
      case 'update_field': case 'create_record': case 'delete_record':
        return <ParamInput label="Target Object" value={action.params.objectName ?? ''} placeholder="Object name" onChange={v => setParam('objectName', v)} />;
      default: return null;
    }
  };

  return (
    <div className={className ?? 'space-y-4'}>
      {/* Trigger Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-yellow-500" />
            Trigger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Trigger Type</Label>
            <Select value={automation.trigger.type} onValueChange={(v) => updateTrigger({ type: v as TriggerConfig['type'] })}>
              <SelectTrigger><SelectValue placeholder="Select trigger type" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TRIGGER_LABELS) as TriggerConfig['type'][]).map(t => (
                  <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsObject && (
            <div className="space-y-1">
              <Label className="text-xs">Object</Label>
              {objects.length > 0 ? (
                <Select value={automation.trigger.objectName ?? ''} onValueChange={(v) => updateTrigger({ objectName: v })}>
                  <SelectTrigger><SelectValue placeholder="Select object" /></SelectTrigger>
                  <SelectContent>
                    {objects.map(o => <SelectItem key={o.name} value={o.name}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={automation.trigger.objectName ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTrigger({ objectName: e.target.value })} placeholder="Object name" />
              )}
            </div>
          )}
          {needsField && (
            <div className="space-y-1">
              <Label className="text-xs">Field</Label>
              {selectedObjectFields ? (
                <Select value={automation.trigger.fieldName ?? ''} onValueChange={(v) => updateTrigger({ fieldName: v })}>
                  <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(selectedObjectFields).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={automation.trigger.fieldName ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTrigger({ fieldName: e.target.value })} placeholder="Field name" />
              )}
            </div>
          )}
          {isScheduled && (
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Cron Schedule</Label>
              <Input value={automation.trigger.schedule ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTrigger({ schedule: e.target.value })} placeholder="e.g. 0 9 * * 1-5" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Condition (optional)</Label>
            <Input value={automation.trigger.condition ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTrigger({ condition: e.target.value })} placeholder='e.g. ${data.status === "active"}' />
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs font-medium">Conditional Trigger (optional)</Label>
            <p className="text-xs text-muted-foreground">Run only when a field matches a specific value.</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Field</Label>
                {selectedObjectFields ? (
                  <Select value={automation.trigger.conditionField ?? ''} onValueChange={(v) => updateTrigger({ conditionField: v })}>
                    <SelectTrigger><SelectValue placeholder="Field" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(selectedObjectFields).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={automation.trigger.conditionField ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTrigger({ conditionField: e.target.value })} placeholder="e.g. status" />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Operator</Label>
                <Select value={automation.trigger.conditionOperator ?? 'equals'} onValueChange={(v) => updateTrigger({ conditionOperator: v as TriggerConfig['conditionOperator'] })}>
                  <SelectTrigger><SelectValue placeholder="Operator" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONDITION_OPERATORS) as NonNullable<TriggerConfig['conditionOperator']>[]).map(op => (
                      <SelectItem key={op} value={op}>{CONDITION_OPERATORS[op]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input value={automation.trigger.conditionValue ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTrigger({ conditionValue: e.target.value })} placeholder="e.g. urgent" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4" /> Actions
            <Badge variant="secondary" className="ml-auto">{automation.actions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {automation.actions.length > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Label className="text-xs">Execution</Label>
              <Select value={automation.executionMode ?? 'sequential'} onValueChange={(v) => setAutomation(prev => ({ ...prev, executionMode: v as 'sequential' | 'parallel' }))}>
                <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {automation.actions.map((action, idx) => (
            <div key={idx} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {ACTION_ICONS[action.type]}
                  <span className="text-sm font-medium">
                    {automation.actions.length > 1 && (automation.executionMode ?? 'sequential') === 'sequential' ? `Step ${idx + 1}` : `Action ${idx + 1}`}
                  </span>
                  {idx > 0 && automation.actions.length > 1 && (automation.executionMode ?? 'sequential') === 'sequential' && (
                    <Badge variant="outline" className="text-[10px] px-1">then</Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => removeAction(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Action Type</Label>
                <Select value={action.type} onValueChange={(v) => updateAction(idx, { type: v as ActionConfig['type'], params: {} })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ACTION_LABELS) as ActionConfig['type'][]).map(t => (
                      <SelectItem key={t} value={t}>{ACTION_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {renderActionParams(action, idx)}
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={addAction}>
            <Plus className="h-4 w-4 mr-2" /> Add Action
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={automation.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutomation(prev => ({ ...prev, name: e.target.value }))} placeholder="Automation name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={automation.description ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutomation(prev => ({ ...prev, description: e.target.value }))} placeholder="Optional description" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enabled</Label>
            <Switch checked={automation.enabled} onCheckedChange={(checked: boolean) => setAutomation(prev => ({ ...prev, enabled: checked }))} />
          </div>
          <Separator />
          <div className="flex items-center gap-2 justify-end">
            {onCancel && <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>}
            <Button size="sm" onClick={() => onSave?.(automation)}>
              <Zap className="h-4 w-4 mr-2" /> Save Automation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
