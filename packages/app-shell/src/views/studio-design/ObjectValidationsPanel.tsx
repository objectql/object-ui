/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — Validations view (builder-ui Phase B).
 *
 * Edits `ObjectSchema.validations` (spec `ValidationRuleSchema`, a
 * discriminated union on `type`). The no-code surface targets the `script`
 * rule — `{ type: 'script', name, message, condition }` where the CEL
 * `condition` is a FAIL predicate (TRUE ⇒ the write is rejected with
 * `message`). The condition editor reuses the metadata-admin
 * `ConditionBuilder`, fed with the DRAFT field list so unpublished fields
 * are pickable.
 *
 * Non-`script` rule types (state_machine / format / cross_field / json /
 * conditional) are surfaced read-only with their type badge — they carry
 * structures a row editor can't honestly express; authoring them stays in
 * code for now. Showing them (rather than hiding) keeps the list a truthful
 * inventory of everything that will run on save.
 */

import React from 'react';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import { ConditionBuilder } from '../metadata-admin/inspectors/ConditionBuilder';
import { readFields } from '../metadata-admin/previews/object-fields-io';

interface ValidationRuleDraft {
  type?: string;
  name?: string;
  label?: string;
  message?: string;
  condition?: string;
  severity?: 'error' | 'warning' | 'info';
  active?: boolean;
  [key: string]: unknown;
}

function readRules(input: unknown): ValidationRuleDraft[] {
  if (!Array.isArray(input)) return [];
  return input.filter((r): r is ValidationRuleDraft => !!r && typeof r === 'object');
}

function nextRuleName(existing: string[]): string {
  let i = existing.length + 1;
  let name = `validation_${i}`;
  const taken = new Set(existing);
  while (taken.has(name)) name = `validation_${++i}`;
  return name;
}

export function ObjectValidationsPanel({
  draft,
  onPatch,
  disabled,
}: {
  draft: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const rules = readRules(draft.validations);
  const [selected, setSelected] = React.useState<string | null>(null);

  const fields = React.useMemo(
    () =>
      readFields(draft.fields).entries.map((e) => ({
        name: e.name,
        label: typeof e.def.label === 'string' ? (e.def.label as string) : undefined,
        hidden: e.def.hidden === true,
      })),
    [draft.fields],
  );

  const commit = (next: ValidationRuleDraft[]) => onPatch({ validations: next });

  const patchRule = (name: string, patch: Partial<ValidationRuleDraft>) =>
    commit(rules.map((r) => (r.name === name ? { ...r, ...patch } : r)));

  const addRule = () => {
    const name = nextRuleName(rules.map((r) => r.name ?? ''));
    // `condition: 'false'` — a VALID never-failing CEL placeholder. An empty
    // condition is rejected by the spec's ExpressionInputSchema, which would
    // 422 the whole draft save and dead-end the create flow (the same
    // required-field-blocks-authoring class as dashboard `layout` / page
    // `regions`). A rule that never fires is safe to save mid-authoring.
    commit([...rules, { type: 'script', name, message: '', condition: 'false', severity: 'error' }]);
    setSelected(name);
  };

  const removeRule = (name: string) => {
    commit(rules.filter((r) => r.name !== name));
    if (selected === name) setSelected(null);
  };

  const sel = rules.find((r) => r.name === selected) ?? null;

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* rule list */}
      <div className="flex w-72 shrink-0 flex-col rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">验证规则</span>
          <span className="text-[11px] text-muted-foreground">({rules.length})</span>
          {!disabled && (
            <button
              type="button"
              onClick={addRule}
              className="ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> 新增
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {rules.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] leading-5 text-muted-foreground">
              还没有验证规则。
              <br />
              规则在保存记录时执行:条件为真 ⇒ 拒绝保存并提示消息。
            </p>
          ) : (
            rules.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => setSelected(r.name ?? null)}
                className={
                  'flex w-full items-start gap-2 border-b px-3 py-2 text-left text-[12px] ' +
                  (selected === r.name ? 'bg-muted' : 'hover:bg-muted/50')
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.label || r.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {r.message || '(无消息)'}
                  </span>
                </span>
                <span
                  className={
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ' +
                    (r.type === 'script'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground')
                  }
                >
                  {r.type ?? 'script'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* rule editor */}
      <div className="flex min-w-0 flex-1 flex-col rounded-lg border">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-muted-foreground">
            选择左侧的规则进行编辑,或点「新增」创建一条。
          </div>
        ) : sel.type !== 'script' ? (
          <div className="flex flex-1 flex-col gap-2 p-4">
            <p className="text-[13px] font-medium">
              {sel.label || sel.name}
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {sel.type}
              </span>
            </p>
            <p className="text-[12px] leading-5 text-muted-foreground">
              「{sel.type}」类型的规则带有结构化配置(状态机转移表 / 格式约束等),暂不支持在此编辑
              —— 请在代码包中维护。消息:{sel.message || '(无)'}
            </p>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeRule(sel.name!)}
                className="mt-auto inline-flex w-fit items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" /> 删除规则
              </button>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">规则名(snake_case,唯一)</span>
              <input
                value={sel.name ?? ''}
                disabled={disabled}
                onChange={(e) => {
                  const name = e.target.value;
                  patchRule(sel.name!, { name });
                  setSelected(name);
                }}
                className="w-full rounded border bg-background px-2 py-1 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">错误消息(校验失败时展示给用户)</span>
              <input
                value={sel.message ?? ''}
                disabled={disabled}
                onChange={(e) => patchRule(sel.name!, { message: e.target.value })}
                placeholder="例如:完成日期在状态为已完成时必填"
                className="w-full rounded border bg-background px-2 py-1 text-[12px]"
              />
            </label>
            <div>
              <span className="mb-1 block text-[11px] text-muted-foreground">
                失败条件(CEL)—— 条件为 <b>真</b> 时,拒绝保存并显示上面的消息;新规则默认{' '}
                <code className="rounded bg-muted px-1">false</code>(永不触发),请改为真实条件
              </span>
              <ConditionBuilder
                value={typeof sel.condition === 'string' ? sel.condition : ''}
                onCommit={(cel) => patchRule(sel.name!, { condition: cel })}
                fields={fields}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[12px]">
                <span className="text-muted-foreground">严重度</span>
                <select
                  value={sel.severity ?? 'error'}
                  disabled={disabled}
                  onChange={(e) => patchRule(sel.name!, { severity: e.target.value as ValidationRuleDraft['severity'] })}
                  className="rounded border bg-background px-1.5 py-0.5 text-[12px]"
                >
                  <option value="error">error(拒绝保存)</option>
                  <option value="warning">warning</option>
                  <option value="info">info</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[12px]">
                <input
                  type="checkbox"
                  checked={sel.active !== false}
                  disabled={disabled}
                  onChange={(e) => patchRule(sel.name!, { active: e.target.checked })}
                />
                启用
              </label>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeRule(sel.name!)}
                  className="ml-auto inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> 删除
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
