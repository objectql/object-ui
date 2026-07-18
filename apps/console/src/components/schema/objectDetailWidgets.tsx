/**
 * Object Detail Widgets
 *
 * Self-contained, schema-driven widget components for the object detail page.
 * Each widget receives an `objectName` from its schema props and looks up
 * data from React context (MetadataProvider) — no prop drilling needed.
 *
 * Registered in the ComponentRegistry so they can be composed via PageSchema
 * and rendered by SchemaRenderer.
 *
 * @module components/schema/objectDetailWidgets
 */

import { useMemo, useState, useCallback, useRef } from 'react';
import { Badge, Button, Input, Textarea } from '@object-ui/components';
import {
  Link2,
  KeyRound,
  LayoutList,
  PanelTop,
  BarChart3,
  Table,
  Pencil,
  Check,
  X,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import type { SchemaNode } from '@object-ui/core';
import { toast } from 'sonner';
import { useMetadata } from '@object-ui/app-shell';
import { useMetadataService } from '@object-ui/app-shell';
import { toObjectDefinition, toFieldDefinition, type MetadataObject } from '../../utils/metadataConverters';
import type { ObjectDefinitionRelationship } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Widget schema interface
// ---------------------------------------------------------------------------

/** Schema props for object detail widgets. All widgets receive `objectName`. */
interface ObjectWidgetSchema extends SchemaNode {
  objectName: string;
}

// ---------------------------------------------------------------------------
// Shared hook: resolve object definition + fields from metadata context
// ---------------------------------------------------------------------------

function useObjectData(objectName: string) {
  const { objects: metadataObjects } = useMetadata();

  const metadataObject: MetadataObject | undefined = useMemo(
    () => (metadataObjects || []).find((o: MetadataObject) => o.name === objectName),
    [metadataObjects, objectName],
  );

  const object = useMemo(
    () => (metadataObject ? toObjectDefinition(metadataObject, 0) : null),
    [metadataObject],
  );

  const fields = useMemo(() => {
    if (!metadataObject) return [];
    const raw = Array.isArray(metadataObject.fields)
      ? metadataObject.fields
      : Object.values(metadataObject.fields || {});
    return raw.map(toFieldDefinition);
  }, [metadataObject]);

  return { object, fields, metadataObject };
}

// ---------------------------------------------------------------------------
// Inline editable field component
// ---------------------------------------------------------------------------

interface InlineFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function InlineField({ label, value, onSave, multiline = false, disabled = false, placeholder }: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const handleEdit = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // toast shown by caller
    } finally {
      setSaving(false);
    }
  }, [draft, value, onSave]);

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); void handleSave(); }
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div className="space-y-1.5 group">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>
        {editing ? (
          <div className="flex items-start gap-1.5">
            {multiline ? (
              <Textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={3}
                className="text-sm flex-1 min-w-0"
                disabled={saving}
              />
            ) : (
              <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="text-sm h-7 flex-1 min-w-0"
                disabled={saving}
              />
            )}
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="mt-0.5 p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 shrink-0"
              aria-label="Save"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="mt-0.5 p-1 rounded text-muted-foreground hover:bg-accent shrink-0"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-h-7">
            <span className="text-sm flex-1 min-w-0 truncate">
              {value || <span className="text-muted-foreground italic">{placeholder || '—'}</span>}
            </span>
            {!disabled && (
              <button
                onClick={handleEdit}
                className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0"
                aria-label={`Edit ${label}`}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectPropertiesWidget — editable
// Schema: { type: 'object-properties', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectPropertiesWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { object, fields, metadataObject } = useObjectData(objectName);
  const { refresh } = useMetadata();
  const metadataService = useMetadataService();

  const handleSaveField = useCallback(
    async (fieldName: string, value: string) => {
      if (!metadataService || !metadataObject) return;
      const updated = { ...metadataObject, [fieldName]: value };
      try {
        await metadataService.saveMetadataItem('object', objectName, updated as Record<string, unknown>);
        await refresh();
        toast.success(`${fieldName === 'label' ? 'Display name' : 'Field'} updated`);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save');
        throw err;
      }
    },
    [metadataService, metadataObject, objectName, refresh],
  );

  if (!object) return null;

  const isSystem = object.isSystem;

  return (
    <div className="space-y-6" data-testid="object-properties">
      {/* Basic Information Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          基本信息
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InlineField
            label="显示名称"
            value={object.label}
            onSave={(v) => handleSaveField('label', v)}
            placeholder="输入显示名称"
            disabled={isSystem}
          />
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-muted-foreground">API 名称</dt>
            <dd className="text-sm font-mono bg-muted/50 rounded px-2 py-1 inline-block">
              {object.name}
            </dd>
          </div>
          <InlineField
            label="复数名称"
            value={object.pluralLabel || ''}
            onSave={(v) => handleSaveField('pluralLabel', v)}
            placeholder="例如：客户们"
            disabled={isSystem}
          />
          <InlineField
            label="分组"
            value={object.group || ''}
            onSave={(v) => handleSaveField('group', v)}
            placeholder="对象分组"
            disabled={isSystem}
          />
          <div className="sm:col-span-2">
            <InlineField
              label="描述"
              value={object.description || ''}
              onSave={(v) => handleSaveField('description', v)}
              multiline
              placeholder="输入对象描述"
              disabled={isSystem}
            />
          </div>
        </dl>
      </div>

      {/* Configuration Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          配置
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-muted-foreground">字段数量</dt>
            <dd className="text-sm font-medium">
              {(object.fieldCount ?? fields.length)} 个字段
            </dd>
          </div>
          {isSystem && (
            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-muted-foreground">类型</dt>
              <dd>
                <Badge variant="secondary" className="font-normal">系统对象</Badge>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectRelationshipsWidget — with add/edit capability
// Schema: { type: 'object-relationships', objectName: 'account' }
// ---------------------------------------------------------------------------

interface RelationshipFormState {
  relatedObject: string;
  type: ObjectDefinitionRelationship['type'];
  label: string;
  foreignKey: string;
}

const RELATIONSHIP_TYPES: { label: string; value: ObjectDefinitionRelationship['type'] }[] = [
  { label: '一对多', value: 'one-to-many' },
  { label: '多对多', value: 'many-to-many' },
  { label: '一对一', value: 'one-to-one' },
  { label: '多对一', value: 'many-to-one' },
];

export function ObjectRelationshipsWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { object, metadataObject } = useObjectData(objectName);
  const { refresh } = useMetadata();
  const metadataService = useMetadataService();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RelationshipFormState>({
    relatedObject: '',
    type: 'one-to-many',
    label: '',
    foreignKey: '',
  });

  const handleAdd = useCallback(async () => {
    if (!metadataService || !metadataObject || !form.relatedObject.trim()) return;
    const newRel = {
      relatedObject: form.relatedObject.trim(),
      type: form.type,
      label: form.label.trim() || undefined,
      foreignKey: form.foreignKey.trim() || undefined,
    };
    const updated = {
      ...metadataObject,
      relationships: [...(Array.isArray(metadataObject.relationships) ? metadataObject.relationships : []), newRel],
    };
    setSaving(true);
    try {
      await metadataService.saveMetadataItem('object', objectName, updated as Record<string, unknown>);
      await refresh();
      toast.success(`关联关系已添加`);
      setShowForm(false);
      setForm({ relatedObject: '', type: 'one-to-many', label: '', foreignKey: '' });
    } catch (err: any) {
      toast.error(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [metadataService, metadataObject, object, form, objectName, refresh]);

  const handleDelete = useCallback(async (index: number) => {
    if (!metadataService || !metadataObject) return;
    const rels = Array.isArray(metadataObject.relationships) ? [...metadataObject.relationships] : [];
    rels.splice(index, 1);
    const updated = { ...metadataObject, relationships: rels };
    setSaving(true);
    try {
      await metadataService.saveMetadataItem('object', objectName, updated as Record<string, unknown>);
      await refresh();
      toast.success('关联关系已删除');
    } catch (err: any) {
      toast.error(err?.message || '删除失败');
    } finally {
      setSaving(false);
    }
  }, [metadataService, metadataObject, objectName, refresh]);

  if (!object) return null;

  const hasRelationships = object.relationships && object.relationships.length > 0;

  return (
    <div className="space-y-4" data-testid="relationships-section">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            关联关系
          </h3>
          {!object.isSystem && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm((v) => !v)}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              添加关联
            </Button>
          )}
        </div>

        {/* Add relationship form */}
        {showForm && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
            <h4 className="text-sm font-medium">新建关联关系</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">关联对象 *</label>
                <Input
                  value={form.relatedObject}
                  onChange={(e) => setForm((f) => ({ ...f, relatedObject: e.target.value }))}
                  placeholder="例如：account"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">关联类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ObjectDefinitionRelationship['type'] }))}
                  className="w-full h-7 text-xs rounded-md border border-input bg-background px-2"
                >
                  {RELATIONSHIP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">显示名称</label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="可选"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">外键字段</label>
                <Input
                  value={form.foreignKey}
                  onChange={(e) => setForm((f) => ({ ...f, foreignKey: e.target.value }))}
                  placeholder="例如：account_id"
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)} disabled={saving}>
                取消
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => void handleAdd()} disabled={saving || !form.relatedObject.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                保存
              </Button>
            </div>
          </div>
        )}

        {hasRelationships ? (
          <div className="space-y-2">
            {object.relationships?.map((rel, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors group"
              >
                <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                  {RELATIONSHIP_TYPES.find((t) => t.value === rel.type)?.label || rel.type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{rel.label || rel.relatedObject}</p>
                  {rel.label && rel.label !== rel.relatedObject && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      关联对象: <span className="font-mono">{rel.relatedObject}</span>
                    </p>
                  )}
                  {rel.foreignKey && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      外键: <span className="font-mono">{rel.foreignKey}</span>
                    </p>
                  )}
                </div>
                {!object.isSystem && (
                  <button
                    onClick={() => void handleDelete(i)}
                    disabled={saving}
                    className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                    aria-label="删除关联"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          !showForm && (
            <div className="text-center py-8 px-4 border border-dashed rounded-lg">
              <Link2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">暂无关联关系。</p>
              {!object.isSystem && (
                <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={() => setShowForm(true)}>
                  <Plus className="h-3 w-3 mr-1" />添加关联
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectKeysWidget
// Schema: { type: 'object-keys', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectKeysWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { fields } = useObjectData(objectName);

  const keyFields = useMemo(
    () => fields.filter((f) => f.unique || f.name === 'id' || f.externalId),
    [fields],
  );

  return (
    <div className="space-y-4" data-testid="keys-section">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          唯一键
        </h3>
        {keyFields.length > 0 ? (
          <div className="space-y-2">
            {keyFields.map((kf) => (
              <div
                key={kf.name}
                className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <Badge
                  variant={kf.name === 'id' ? 'default' : 'outline'}
                  className="text-xs shrink-0 mt-0.5"
                >
                  {kf.name === 'id' ? '主键' : kf.externalId ? '外部 ID' : '唯一'}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{kf.label || kf.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    类型: <span className="font-mono">{kf.type}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 border border-dashed rounded-lg">
            <KeyRound className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">未找到唯一键或主键。</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectDataExperienceWidget
// Schema: { type: 'object-data-experience', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectDataExperienceWidget(_props: { schema: ObjectWidgetSchema }) {
  return (
    <div className="space-y-4" data-testid="data-experience-section">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          数据体验
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          配置用户与此对象数据的交互方式
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border p-5 text-center hover:bg-accent/30 transition-colors cursor-pointer" data-testid="data-experience-forms">
            <PanelTop className="h-7 w-7 mx-auto mb-2.5 text-muted-foreground" />
            <p className="text-sm font-semibold mb-1">表单</p>
            <p className="text-xs text-muted-foreground">设计数据录入表单</p>
          </div>
          <div className="rounded-lg border p-5 text-center hover:bg-accent/30 transition-colors cursor-pointer" data-testid="data-experience-views">
            <LayoutList className="h-7 w-7 mx-auto mb-2.5 text-muted-foreground" />
            <p className="text-sm font-semibold mb-1">视图</p>
            <p className="text-xs text-muted-foreground">配置列表和详情视图</p>
          </div>
          <div className="rounded-lg border p-5 text-center hover:bg-accent/30 transition-colors cursor-pointer" data-testid="data-experience-dashboards">
            <BarChart3 className="h-7 w-7 mx-auto mb-2.5 text-muted-foreground" />
            <p className="text-sm font-semibold mb-1">仪表盘</p>
            <p className="text-xs text-muted-foreground">构建可视化仪表盘</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectDataPreviewWidget
// Schema: { type: 'object-data-preview', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectDataPreviewWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { object } = useObjectData(objectName);

  return (
    <div className="space-y-4" data-testid="data-preview-section">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          数据预览
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          查看此对象的示例记录
        </p>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Table className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium mb-1">示例数据</p>
          <p className="text-xs text-muted-foreground">
            &ldquo;{object?.label || objectName}&rdquo; 的实时数据预览将在此处显示
          </p>
        </div>
      </div>
    </div>
  );
}
