// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ExcelImportBar — the "my real data is in it" half of the Excel→App wedge
 * (cloud#797). When a user attaches a spreadsheet in the AI build panel, the
 * agent parses a brief and builds the schema; this bar then lets them load the
 * SAME file's real rows into a built object in two clicks — no re-picking the
 * file, no hunting for the Import button in a list view.
 *
 * It's a thin host: pick a target object → hand the attached File straight to
 * the existing ImportWizard with `initialFile`, which owns parsing, column
 * mapping, dry-run and the real server-side import. So the magic-flow trial
 * goes from "one sentence → app with demo data" to "app with MY data" — the
 * retention hinge for a spreadsheet refugee.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Badge } from '@object-ui/components';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { toast } from 'sonner';
import { ImportWizard } from '@object-ui/plugin-grid';

type I18n = { en: string; zh: string };

interface WizardField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Array<{ label?: string; value?: string | number } | string>;
}

interface ExcelImportBarProps {
  /** The attached spreadsheet, retained by the composer (objectui#2386). */
  file: File;
  /** The console data adapter (has getObjectSchema + import routes). */
  dataSource: any;
  /** Pre-select this object (e.g. the one just built this session). */
  defaultObjectName?: string;
  /** Called when the user dismisses the bar or an import completes. */
  onDone: () => void;
}

function pick(label: I18n): string {
  const lang =
    (typeof document !== 'undefined' && document.documentElement.getAttribute('lang')) || 'en';
  return lang.toLowerCase().startsWith('zh') ? label.zh : label.en;
}

const SKIP_OBJECT_PREFIXES = ['sys_', 'ai_', 'cloud_'];
const NON_WRITABLE_TYPES = ['formula', 'summary', 'autonumber'];

/** Normalize a getObjectSchema result's fields → the ImportWizard field shape. */
function normalizeFields(schema: any): WizardField[] {
  const raw = schema?.fields ?? schema?.data?.fields ?? schema?.item?.fields ?? {};
  const entries: Array<[string, any]> = Array.isArray(raw)
    ? raw.map((f: any) => [f?.name, f])
    : Object.entries(raw);
  return entries
    .map(([name, def]) => ({
      name: (def?.name ?? name) as string,
      label: (def?.label ?? def?.name ?? name) as string,
      type: (def?.type ?? 'text') as string,
      required: !!def?.required,
      options: def?.options,
    }))
    .filter((f) => f.name && !NON_WRITABLE_TYPES.includes(f.type));
}

export function ExcelImportBar({ file, dataSource, defaultObjectName, onDone }: ExcelImportBarProps) {
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);
  const [objects, setObjects] = useState<Array<{ name: string; label: string }> | null>(null);
  const [selected, setSelected] = useState<string>(defaultObjectName ?? '');
  const [loadingFields, setLoadingFields] = useState(false);
  const [fields, setFields] = useState<WizardField[] | null>(null);
  const [open, setOpen] = useState(false);

  // List the env's user objects so the user can target the import. Uses the
  // uncached meta list endpoint; filters platform/system objects.
  useEffect(() => {
    let cancelled = false;
    const apiBase = ((import.meta as any).env?.VITE_SERVER_URL || '').replace(/\/+$/, '');
    (async () => {
      try {
        const res = await authFetch(`${apiBase}/api/v1/meta/object`, { method: 'GET', credentials: 'include' });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json().catch(() => null);
        const items = json?.data?.items ?? json?.items ?? json?.data ?? (Array.isArray(json) ? json : []);
        const objs = (Array.isArray(items) ? items : [])
          .map((o: any) => ({ name: o?.name as string, label: (o?.label as string) || (o?.name as string) }))
          .filter((o: { name: string }) => o.name && !SKIP_OBJECT_PREFIXES.some((p) => o.name.startsWith(p)));
        if (cancelled) return;
        setObjects(objs);
        if (!selected && objs.length) {
          const preferred = defaultObjectName && objs.find((o: { name: string }) => o.name === defaultObjectName);
          setSelected(preferred ? defaultObjectName! : objs[0].name);
        }
      } catch {
        if (!cancelled) setObjects([]);
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch, defaultObjectName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openWizard() {
    if (!selected) return;
    setLoadingFields(true);
    try {
      const schema = await dataSource.getObjectSchema(selected);
      const f = normalizeFields(schema);
      if (!f.length) {
        toast.error(pick({ en: 'That object has no importable fields.', zh: '该对象没有可导入的字段。' }));
        return;
      }
      setFields(f);
      setOpen(true);
    } catch {
      toast.error(pick({ en: 'Could not read the object schema.', zh: '无法读取对象结构。' }));
    } finally {
      setLoadingFields(false);
    }
  }

  const selectedLabel = objects?.find((o) => o.name === selected)?.label ?? selected;

  if (open && fields) {
    return (
      <ImportWizard
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) onDone(); }}
        objectName={selected}
        objectLabel={selectedLabel}
        fields={fields}
        dataSource={dataSource}
        initialFile={file}
        onComplete={(result) => {
          toast.success(
            pick({
              en: `Imported ${result.importedRows} row(s) into ${selectedLabel}.`,
              zh: `已把 ${result.importedRows} 行真实数据导入「${selectedLabel}」。`,
            }),
          );
        }}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" data-excel-import-bar>
      <Badge variant="secondary">CSV / Excel</Badge>
      <span className="text-muted-foreground">
        {pick({ en: 'Import the real rows from', zh: '把真实数据导入自' })}
      </span>
      <code className="font-medium">{file.name}</code>
      <span className="text-muted-foreground">{pick({ en: 'into', zh: '到' })}</span>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={!objects || objects.length === 0}
      >
        {(objects ?? []).map((o) => (
          <option key={o.name} value={o.name}>{o.label}</option>
        ))}
      </select>
      <Button size="sm" onClick={openWizard} disabled={!selected || loadingFields}>
        {loadingFields ? pick({ en: 'Opening…', zh: '打开中…' }) : pick({ en: 'Import', zh: '导入' })}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        {pick({ en: 'Dismiss', zh: '忽略' })}
      </Button>
    </div>
  );
}
