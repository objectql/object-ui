/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — object Settings view (builder-ui Phase B).
 *
 * Two stacked cards:
 *  1. Basics — hosts the SAME default inspector metadata-admin uses
 *     (`getMetadataDefaultInspector('object')` → ObjectDefaultInspector):
 *     label / pluralLabel / icon / description, one implementation for both
 *     surfaces.
 *  2. Semantic roles (ADR-0085) — the cross-surface presentation roles:
 *     `nameField`, `stageField` (string | false | unset), `highlightFields`.
 *     These are the ONLY presentation knobs the protocol carries, so the
 *     builder must make them directly editable — otherwise designers fall
 *     back to guessing which heuristic picked their title/stepper/columns.
 */

import React from 'react';
import { Settings2, Sparkles, X } from 'lucide-react';
import { getMetadataDefaultInspector } from '../metadata-admin/default-inspector-registry';
import { readFields } from '../metadata-admin/previews/object-fields-io';
import type { SupportedLocale } from '../metadata-admin/i18n';

export function ObjectSettingsPanel({
  name,
  draft,
  onPatch,
  disabled,
  locale,
}: {
  name: string;
  draft: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  disabled?: boolean;
  locale: SupportedLocale;
}) {
  const DefaultInspector = getMetadataDefaultInspector('object');

  const fields = React.useMemo(() => readFields(draft.fields).entries, [draft.fields]);
  const selectFields = fields.filter((e) => (e.def.type ?? 'text') === 'select');

  const nameField = typeof draft.nameField === 'string' ? draft.nameField : '';
  const stageField = draft.stageField as string | false | undefined;
  const highlightFields = Array.isArray(draft.highlightFields)
    ? (draft.highlightFields as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];

  const highlightCandidates = fields.filter(
    (e) => e.def.hidden !== true && !highlightFields.includes(e.name),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <section className="rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">基础信息</span>
        </header>
        <div className="max-w-xl p-3">
          {DefaultInspector ? (
            <DefaultInspector
              type="object"
              name={name}
              draft={draft}
              onPatch={onPatch}
              readOnly={!!disabled}
              locale={locale}
            />
          ) : (
            <p className="text-[12px] text-muted-foreground">未注册对象默认检查器。</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">语义角色</span>
          <span className="text-[11px] text-muted-foreground">
            跨表单 / 列表 / 详情统一生效(ADR-0085)
          </span>
        </header>
        <div className="grid max-w-xl gap-4 p-3">
          {/* nameField */}
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              记录名称字段(nameField)—— 标题、链接、引用处显示的字段
            </span>
            <select
              value={nameField}
              disabled={disabled}
              onChange={(e) => onPatch(e.target.value ? { nameField: e.target.value } : { nameField: undefined })}
              className="w-full rounded border bg-background px-2 py-1 text-[12px]"
            >
              <option value="">(自动推导)</option>
              {fields.map((e) => (
                <option key={e.name} value={e.name}>
                  {typeof e.def.label === 'string' ? `${e.def.label} (${e.name})` : e.name}
                </option>
              ))}
            </select>
          </label>

          {/* stageField */}
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              生命周期字段(stageField)—— 详情页顶部进度条按它的选项渲染
            </span>
            <select
              value={stageField === false ? '__none__' : (stageField ?? '')}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                onPatch({ stageField: v === '__none__' ? false : v === '' ? undefined : v });
              }}
              className="w-full rounded border bg-background px-2 py-1 text-[12px]"
            >
              <option value="">(自动探测 status/stage 等字段名)</option>
              <option value="__none__">无 —— 这个对象没有线性流程,不显示进度条</option>
              {selectFields.map((e) => (
                <option key={e.name} value={e.name}>
                  {typeof e.def.label === 'string' ? `${e.def.label} (${e.name})` : e.name}
                </option>
              ))}
            </select>
          </label>

          {/* highlightFields */}
          <div>
            <span className="mb-1 block text-[11px] text-muted-foreground">
              重点字段(highlightFields)—— 默认列表列、卡片、详情顶栏取前 4;顺序即展示顺序
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {highlightFields.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                >
                  {f}
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={`移除 ${f}`}
                      onClick={() => onPatch({ highlightFields: highlightFields.filter((x) => x !== f) })}
                      className="rounded-full hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {!disabled && highlightCandidates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onPatch({ highlightFields: [...highlightFields, e.target.value] });
                  }}
                  className="rounded border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  <option value="">+ 添加字段…</option>
                  {highlightCandidates.map((e) => (
                    <option key={e.name} value={e.name}>
                      {typeof e.def.label === 'string' ? `${e.def.label} (${e.name})` : e.name}
                    </option>
                  ))}
                </select>
              )}
              {highlightFields.length === 0 && (
                <span className="text-[11px] text-muted-foreground">(未声明 —— 各处按启发式自动挑选)</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
