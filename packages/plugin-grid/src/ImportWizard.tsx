/**
 * ObjectUI – Copyright (c) 2024-present ObjectStack Inc.
 * Licensed under MIT. Phase 15 L1: CSV/Excel Import Wizard
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  cn, Button, Badge, Progress, Input,
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@object-ui/components';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowRight, ArrowLeft, Save, Trash2, ClipboardPaste } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/react';
import {
  parseSpreadsheetFile, parseClipboardTable, inferColumnType, isTypeCompatible,
  ImportParseError, type InferredType,
} from './importParsers';

/** Default English fallback strings used when no I18nProvider is mounted
 *  (standalone / unit-test usage). Mirrors the keys under `grid.import.*`. */
const IMPORT_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'grid.import.title': 'Import {{object}}',
  'grid.import.stepUpload': 'Upload',
  'grid.import.stepMapping': 'Mapping',
  'grid.import.stepPreview': 'Preview',
  'grid.import.uploadDescription': 'Upload a CSV or Excel file, or paste from a spreadsheet to get started.',
  'grid.import.mappingDescription': 'Map columns to object fields.',
  'grid.import.previewDescription': 'Review data before importing.',
  'grid.import.dragDrop': 'Drag & drop a CSV or Excel file here, or click to browse',
  'grid.import.browseFiles': 'Browse Files',
  'grid.import.parsing': 'Parsing…',
  'grid.import.pasteHint': 'or paste (Ctrl/⌘+V) rows copied from Excel or Google Sheets',
  'grid.import.legacyXls': "Legacy .xls files aren't supported — please re-save as .xlsx.",
  'grid.import.unsupportedFile': 'Unsupported file type. Use CSV, TSV, or Excel (.xlsx).',
  'grid.import.parseFailed': 'Could not read this file. Please check the format and try again.',
  'grid.import.fileNeedsHeader': 'File must contain a header row and at least one data row.',
  'grid.import.mappingTemplate': 'Mapping template:',
  'grid.import.chooseTemplate': 'Choose template…',
  'grid.import.noSavedTemplates': 'No saved templates',
  'grid.import.noneOption': '— None —',
  'grid.import.saveCurrent': 'Save current',
  'grid.import.templateName': 'Template name',
  'grid.import.save': 'Save',
  'grid.import.deleteTemplate': 'Delete template',
  'grid.import.csvColumn': 'Column',
  'grid.import.mapsTo': 'Maps To',
  'grid.import.typeMismatch': 'Looks like {{type}}',
  'grid.import.type.number': 'Number',
  'grid.import.type.boolean': 'Boolean',
  'grid.import.type.date': 'Date',
  'grid.import.type.datetime': 'Date & time',
  'grid.import.type.text': 'Text',
  'grid.import.status': 'Status',
  'grid.import.skipColumn': 'Skip column',
  'grid.import.skip': '— Skip —',
  'grid.import.mapped': 'Mapped',
  'grid.import.skipped': 'Skipped',
  'grid.import.rowsWithErrors': '{{count}} row(s) with errors',
  'grid.import.rowsCorrected': '{{count}} row(s) corrected',
  'grid.import.clickToFix': '— click a highlighted cell to fix it inline.',
  'grid.import.showingRows': 'Showing {{shown}} of {{total}} rows',
  'grid.import.importing': 'Importing… {{progress}}%',
  'grid.import.importComplete': 'Import Complete',
  'grid.import.imported': '{{count}} imported',
  'grid.import.skippedCount': '{{count}} skipped',
  'grid.import.moreErrors': '…and {{count}} more errors',
  'grid.import.cancel': 'Cancel',
  'grid.import.back': 'Back',
  'grid.import.next': 'Next',
  'grid.import.close': 'Close',
  'grid.import.importNRows': 'Import {{count}} Rows',
  'grid.import.importingProgress': 'Importing…',
  'grid.import.required': 'Required',
  'grid.import.invalidType': 'Invalid {{type}}',
};

/** Apply `{{var}}` interpolation to a translation template. */
function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
  }
  return out;
}

/** Translation hook with safe English fallback for standalone usage.
 *  Mirrors the pattern in ObjectGrid.tsx — when no I18nProvider is mounted
 *  (e.g. unit tests) the hook still resolves `grid.import.*`
 *  keys via the embedded defaults so the wizard stays usable. */
function useImportTranslation(): { t: (key: string, vars?: Record<string, unknown>) => string } {
  const fallback = (key: string, vars?: Record<string, unknown>) =>
    interpolate(IMPORT_DEFAULT_TRANSLATIONS[key] ?? key, vars);
  try {
    const result = useObjectTranslation();
    const probe = result.t('grid.import.title');
    if (probe === 'grid.import.title') return { t: fallback };
    return {
      t: (key, vars) => {
        const v = result.t(key, vars as Record<string, unknown> | undefined);
        return v === key ? fallback(key, vars) : v;
      },
    };
  } catch {
    return { t: fallback };
  }
}

/** @internal — exported solely for unit tests. */
export const __testables = {
  get mappingToTemplatePayload() { return mappingToTemplatePayload; },
  get applyTemplate() { return applyTemplate; },
  get loadTemplates() { return loadTemplates; },
  get saveTemplates() { return saveTemplates; },
  get autoMapColumns() { return autoMapColumns; },
};

/** A reusable column-mapping template, persisted across sessions. Keys are
 *  CSV header names (case-insensitive) so a template can apply across files
 *  whose columns are reordered or sparsely present. */
export interface ImportMappingTemplate {
  id: string;
  name: string;
  /** Map of CSV header name → object field name. */
  mapping: Record<string, string>;
  updatedAt: number;
}

/** Minimal localStorage-shaped contract; injectable for tests. */
export interface ImportTemplateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ImportWizardProps {
  objectName: string;
  objectLabel?: string;
  fields: Array<{ name: string; label: string; type: string; required?: boolean }>;
  dataSource: any;
  onComplete?: (result: ImportResult) => void;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Error handling strategy: 'skip' skips invalid rows, 'stop' aborts on first error. @default 'skip' */
  onErrorMode?: 'skip' | 'stop';
  /** Override the storage key under which mapping templates are persisted.
   *  Defaults to `objectui:import-templates:${objectName}`. */
  templateStorageKey?: string;
  /** Override the storage backend (defaults to window.localStorage). Use this
   *  to disable persistence (`null`) or to inject an in-memory store in tests. */
  templateStorage?: ImportTemplateStorage | null;
}

export interface ImportResult {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

type WizardStep = 'upload' | 'mapping' | 'preview';

/** Maximum number of rows to show in the preview step */
const PREVIEW_ROW_COUNT = 10;

function validateValue(value: string, type: string): boolean {
  if (!value) return true;
  switch (type) {
    case 'number': case 'currency': case 'percent': return !isNaN(Number(value));
    case 'boolean': return ['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase());
    case 'date': case 'datetime': return !isNaN(Date.parse(value));
    default: return true;
  }
}

const normalizeKey = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '');

/**
 * Auto-map source columns to object fields. Pass 1 matches by normalized
 * name/label (exact). Pass 2 fills still-unmapped columns by fuzzy name
 * containment *gated on type compatibility* with the column's inferred type —
 * the type gate keeps the fuzzy pass from confidently mis-mapping. `rows` is
 * optional; without it only the exact pass runs.
 */
function autoMapColumns(
  headers: string[],
  fields: ImportWizardProps['fields'],
  rows?: string[][],
): Record<number, string> {
  const mapping: Record<number, string> = {};
  const used = new Set<string>();
  // Pass 1 — exact normalized name/label match.
  headers.forEach((header, idx) => {
    const h = normalizeKey(header);
    const match = fields.find((f) => normalizeKey(f.name) === h || normalizeKey(f.label) === h);
    if (match && !used.has(match.name)) { mapping[idx] = match.name; used.add(match.name); }
  });
  // Pass 2 — fuzzy containment, gated on inferred-type compatibility.
  if (rows && rows.length) {
    headers.forEach((header, idx) => {
      if (mapping[idx]) return;
      const h = normalizeKey(header);
      if (h.length < 3) return;
      const inferred = inferColumnType(rows.map((r) => r[idx]));
      const match = fields.find((f) => {
        if (used.has(f.name)) return false;
        if (!isTypeCompatible(inferred, f.type)) return false;
        const name = normalizeKey(f.name);
        const label = normalizeKey(f.label);
        return name.includes(h) || h.includes(name) || label.includes(h) || h.includes(label);
      });
      if (match) { mapping[idx] = match.name; used.add(match.name); }
    });
  }
  return mapping;
}

/** Resolve the storage backend, defaulting to window.localStorage when available. */
function defaultTemplateStorage(): ImportTemplateStorage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

/** Load and persist named mapping templates. Header keys are stored
 *  case-insensitively so templates apply across files with different casing. */
function loadTemplates(storage: ImportTemplateStorage | null, key: string): ImportMappingTemplate[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.id && t.name && t.mapping) : [];
  } catch { return []; }
}

function saveTemplates(storage: ImportTemplateStorage | null, key: string, templates: ImportMappingTemplate[]) {
  if (!storage) return;
  try { storage.setItem(key, JSON.stringify(templates)); } catch { /* quota etc */ }
}

/** Convert an index-based mapping back to a header-name template payload. */
function mappingToTemplatePayload(headers: string[], mapping: Record<number, string>): Record<string, string> {
  const payload: Record<string, string> = {};
  Object.entries(mapping).forEach(([idx, fieldName]) => {
    const header = headers[Number(idx)];
    if (header) payload[header.trim().toLowerCase()] = fieldName;
  });
  return payload;
}

/** Apply a header-name template to current headers, producing an index map. */
function applyTemplate(
  template: ImportMappingTemplate,
  headers: string[],
  fields: ImportWizardProps['fields'],
): Record<number, string> {
  const validFieldNames = new Set(fields.map((f) => f.name));
  const next: Record<number, string> = {};
  headers.forEach((header, idx) => {
    const fieldName = template.mapping[header.trim().toLowerCase()];
    if (fieldName && validFieldNames.has(fieldName)) next[idx] = fieldName;
  });
  return next;
}

type MappedCol = { csvIdx: number; field: ImportWizardProps['fields'][0] };

function validateRow(row: string[], mappedCols: MappedCol[], rowIndex: number) {
  const errors: ImportResult['errors'] = [];
  const record: Record<string, any> = {};
  for (const col of mappedCols) {
    const raw = row[col.csvIdx] ?? '';
    if (col.field.required && !raw) {
      errors.push({ row: rowIndex, field: col.field.name, message: 'Required field is empty' });
      continue;
    }
    if (raw && !validateValue(raw, col.field.type)) {
      errors.push({ row: rowIndex, field: col.field.name, message: `Invalid ${col.field.type} value: "${raw}"` });
      continue;
    }
    record[col.field.name] = raw;
  }
  return { record, errors };
}

/** Map a thrown import-parse error code to a translated, user-facing message. */
function parseErrorMessage(err: unknown, t: (k: string, v?: Record<string, unknown>) => string): string {
  const code = err instanceof Error ? err.message : '';
  if (code === ImportParseError.LegacyXls) return t('grid.import.legacyXls');
  if (code === ImportParseError.Unsupported) return t('grid.import.unsupportedFile');
  return t('grid.import.parseFailed');
}

// Step 1: File Upload (CSV / Excel / paste)
const StepUpload: React.FC<{ onFileLoaded: (headers: string[], rows: string[][]) => void }> = ({ onFileLoaded }) => {
  const { t } = useImportTranslation();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Validate a freshly-parsed grid and hand it to the wizard, or report why not. */
  const acceptParsed = useCallback((parsed: string[][]) => {
    if (parsed.length < 2) { setError(t('grid.import.fileNeedsHeader')); return false; }
    onFileLoaded(parsed[0], parsed.slice(1));
    return true;
  }, [onFileLoaded, t]);

  const processFile = useCallback(async (file: File) => {
    setError(null); setBusy(true);
    try {
      acceptParsed(await parseSpreadsheetFile(file));
    } catch (err) {
      setError(parseErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }, [acceptParsed, t]);

  // Paste-to-import: while this step is mounted, intercept paste of tabular
  // data copied from Excel/Sheets. Ignored when focus is in a text input so we
  // don't hijack ordinary editing.
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && /^(input|textarea)$/i.test(el.tagName)) return;
    const data = e.clipboardData;
    if (!data) return;
    const parsed = parseClipboardTable(data.getData('text/html') || null, data.getData('text/plain') || null);
    if (!parsed) return;
    e.preventDefault();
    setError(null);
    if (!acceptParsed(parsed)) { /* message already set */ }
  }, [acceptParsed]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          busy && 'pointer-events-none opacity-60',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void processFile(f); }}
      >
        <Upload className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{busy ? t('grid.import.parsing') : t('grid.import.dragDrop')}</p>
        <label>
          <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void processFile(f); }} />
          <Button variant="outline" size="sm" asChild><span>{t('grid.import.browseFiles')}</span></Button>
        </label>
        <p className="flex items-center gap-1 text-xs text-muted-foreground/80">
          <ClipboardPaste className="h-3.5 w-3.5" /> {t('grid.import.pasteHint')}
        </p>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </div>
  );
};

// Template bar for save / load / delete of column-mapping templates.
const TemplateBar: React.FC<{
  templates: ImportMappingTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSaveAs: (name: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}> = ({ templates, selectedId, onSelect, onSaveAs, onDelete, disabled }) => {
  const { t } = useImportTranslation();
  const [savingName, setSavingName] = useState('');
  const [showSave, setShowSave] = useState(false);
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
      data-testid="import-template-bar"
    >
      <Save className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">{t('grid.import.mappingTemplate')}</span>
      <Select
        value={selectedId ?? '__none__'}
        onValueChange={(v) => v !== '__none__' && onSelect(v)}
      >
        <SelectTrigger className="h-7 w-48 text-xs" data-testid="import-template-select">
          <SelectValue placeholder={templates.length ? t('grid.import.chooseTemplate') : t('grid.import.noSavedTemplates')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" disabled={templates.length === 0}>
            {templates.length ? t('grid.import.noneOption') : t('grid.import.noSavedTemplates')}
          </SelectItem>
          {templates.map((tpl) => (
            <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!showSave ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowSave(true)}
          disabled={disabled}
          data-testid="import-template-save-btn"
        >
          {t('grid.import.saveCurrent')}
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            value={savingName}
            onChange={(e) => setSavingName(e.target.value)}
            placeholder={t('grid.import.templateName')}
            className="h-7 w-40 text-xs"
            data-testid="import-template-name-input"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={() => { if (savingName.trim()) { onSaveAs(savingName.trim()); setSavingName(''); setShowSave(false); } }}
            disabled={!savingName.trim() || disabled}
            data-testid="import-template-confirm-save"
          >
            {t('grid.import.save')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setShowSave(false); setSavingName(''); }}>
            {t('grid.import.cancel')}
          </Button>
        </div>
      )}
      {selectedId && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label={t('grid.import.deleteTemplate')}
          data-testid="import-template-delete-btn"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

// Step 2: Column Mapping
const StepMapping: React.FC<{
  headers: string[];
  fields: ImportWizardProps['fields'];
  mapping: Record<number, string>;
  onMappingChange: (mapping: Record<number, string>) => void;
  inferredTypes: InferredType[];
  templates: ImportMappingTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onSaveTemplate: (name: string) => void;
  onDeleteTemplate: () => void;
}> = ({ headers, fields, mapping, onMappingChange, inferredTypes, templates, selectedTemplateId, onSelectTemplate, onSaveTemplate, onDeleteTemplate }) => {
  const { t } = useImportTranslation();
  const usedFields = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const handleChange = useCallback((colIdx: number, fieldName: string) => {
    const next = { ...mapping };
    if (fieldName === '__skip__') delete next[colIdx]; else next[colIdx] = fieldName;
    onMappingChange(next);
  }, [mapping, onMappingChange]);

  return (
    <div>
      <TemplateBar
        templates={templates}
        selectedId={selectedTemplateId}
        onSelect={onSelectTemplate}
        onSaveAs={onSaveTemplate}
        onDelete={onDeleteTemplate}
        disabled={Object.keys(mapping).length === 0}
      />
      <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('grid.import.csvColumn')}</TableHead>
            <TableHead>{t('grid.import.mapsTo')}</TableHead>
            <TableHead className="w-24 text-center">{t('grid.import.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {headers.map((header, idx) => {
            const inferred = inferredTypes[idx] ?? 'text';
            const mappedField = mapping[idx] ? fields.find((f) => f.name === mapping[idx]) : undefined;
            const typeMismatch = !!mappedField && !isTypeCompatible(inferred, mappedField.type);
            return (
            <TableRow key={idx}>
              <TableCell className="font-medium">
                <div className="flex flex-col gap-0.5">
                  <span>{header}</span>
                  {inferred !== 'text' && (
                    <Badge variant="outline" className="w-fit text-[10px] font-normal text-muted-foreground" data-testid={`import-inferred-${idx}`}>
                      {t(`grid.import.type.${inferred}`)}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Select value={mapping[idx] ?? '__skip__'} onValueChange={(v) => handleChange(idx, v)}>
                  <SelectTrigger className="h-8 w-56"><SelectValue placeholder={t('grid.import.skipColumn')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">{t('grid.import.skip')}</SelectItem>
                    {fields.map((f) => (
                      <SelectItem key={f.name} value={f.name} disabled={usedFields.has(f.name) && mapping[idx] !== f.name}>
                        {f.label}{f.required ? ' *' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeMismatch && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600" data-testid={`import-type-warn-${idx}`}>
                    <AlertCircle className="h-3 w-3" /> {t('grid.import.typeMismatch', { type: t(`grid.import.type.${inferred}`) })}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-center">
                {mapping[idx]
                  ? <Badge variant="default" className="text-xs">{t('grid.import.mapped')}</Badge>
                  : <Badge variant="secondary" className="text-xs">{t('grid.import.skipped')}</Badge>}
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};

// Step 3: Preview & Import (shows first 10 rows with per-row validation errors)
const StepPreview: React.FC<{
  headers: string[]; rows: string[][]; mapping: Record<number, string>; fields: ImportWizardProps['fields'];
  /** Inline corrections keyed by row index → csv column index → fixed value. */
  corrections: Record<number, Record<number, string>>;
  onCorrect: (rowIdx: number, csvIdx: number, value: string) => void;
}> = ({ headers, rows, mapping, fields, corrections, onCorrect }) => {
  const { t } = useImportTranslation();
  const mappedCols = useMemo(() =>
    Object.entries(mapping).map(([idx, fieldName]) => ({
      csvIdx: Number(idx), header: headers[Number(idx)], field: fields.find((f) => f.name === fieldName)!,
    })), [mapping, headers, fields]);
  const previewRows = rows.slice(0, PREVIEW_ROW_COUNT);

  /** Resolve the effective value for a cell, preferring an inline correction. */
  const effectiveValue = useCallback((rIdx: number, csvIdx: number) => {
    const fix = corrections[rIdx]?.[csvIdx];
    return fix !== undefined ? fix : (previewRows[rIdx]?.[csvIdx] ?? '');
  }, [corrections, previewRows]);

  const rowValidations = useMemo(() => previewRows.map((_row, rIdx) => {
    const errs: Record<number, string> = {};
    for (const col of mappedCols) {
      const raw = effectiveValue(rIdx, col.csvIdx);
      if (col.field.required && !raw) errs[col.csvIdx] = t('grid.import.required');
      else if (raw && !validateValue(raw, col.field.type)) errs[col.csvIdx] = t('grid.import.invalidType', { type: col.field.type });
    }
    return errs;
  }), [previewRows, mappedCols, effectiveValue, t]);

  const errorCount = rowValidations.filter(e => Object.keys(e).length > 0).length;
  const correctedCount = Object.keys(corrections).length;

  return (
    <div className="max-h-[440px] overflow-auto">
      {(errorCount > 0 || correctedCount > 0) && (
        <p
          className="mb-2 flex items-center gap-2 text-xs"
          data-testid="import-preview-status"
        >
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {t('grid.import.rowsWithErrors', { count: errorCount })}
            </span>
          )}
          {correctedCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('grid.import.rowsCorrected', { count: correctedCount })}
            </span>
          )}
          <span className="text-muted-foreground">{t('grid.import.clickToFix')}</span>
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            {mappedCols.map((col) => <TableHead key={col.csvIdx}>{col.field.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewRows.map((_row, rIdx) => {
            const errs = rowValidations[rIdx];
            const hasError = Object.keys(errs).length > 0;
            const wasCorrected = corrections[rIdx] !== undefined;
            return (
              <TableRow
                key={rIdx}
                className={cn(hasError && 'bg-destructive/5', !hasError && wasCorrected && 'bg-emerald-50 dark:bg-emerald-950/20')}
                data-testid={`import-preview-row-${rIdx}`}
              >
                <TableCell className="text-xs text-muted-foreground">{rIdx + 1}</TableCell>
                {mappedCols.map((col) => {
                  const value = effectiveValue(rIdx, col.csvIdx);
                  const cellErr = errs[col.csvIdx];
                  const wasFixed = corrections[rIdx]?.[col.csvIdx] !== undefined;
                  return (
                    <TableCell
                      key={col.csvIdx}
                      className={cn(cellErr && 'text-destructive', wasFixed && !cellErr && 'text-emerald-600')}
                      title={cellErr}
                    >
                      <Input
                        value={value}
                        onChange={(e) => onCorrect(rIdx, col.csvIdx, e.target.value)}
                        className={cn(
                          'h-7 px-1 text-xs',
                          cellErr && 'border-destructive',
                          wasFixed && !cellErr && 'border-emerald-500',
                        )}
                        data-testid={`import-preview-cell-${rIdx}-${col.csvIdx}`}
                        aria-invalid={cellErr ? 'true' : 'false'}
                        aria-label={`${col.field.label} for row ${rIdx + 1}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">{t('grid.import.showingRows', { shown: previewRows.length, total: rows.length })}</p>
    </div>
  );
};

// Main wizard component
export const ImportWizard: React.FC<ImportWizardProps> = ({
  objectName, objectLabel, fields, dataSource, onComplete, onCancel, open, onOpenChange, onErrorMode = 'skip',
  templateStorageKey, templateStorage,
}) => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [corrections, setCorrections] = useState<Record<number, Record<number, string>>>({});
  const label = objectLabel ?? objectName;

  // Template storage — resolved once; `null` opts out of persistence.
  const storage = useMemo<ImportTemplateStorage | null>(
    () => (templateStorage === undefined ? defaultTemplateStorage() : templateStorage),
    [templateStorage],
  );
  const storageKey = templateStorageKey ?? `objectui:import-templates:${objectName}`;
  const [templates, setTemplates] = useState<ImportMappingTemplate[]>(() => loadTemplates(storage, storageKey));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Re-hydrate templates if the storage backend or key changes.
  useEffect(() => { setTemplates(loadTemplates(storage, storageKey)); }, [storage, storageKey]);

  const handleSelectTemplate = useCallback((id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSelectedTemplateId(id);
    setMapping(applyTemplate(tpl, headers, fields));
  }, [templates, headers, fields]);

  const handleSaveTemplate = useCallback((name: string) => {
    const tpl: ImportMappingTemplate = {
      id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      mapping: mappingToTemplatePayload(headers, mapping),
      updatedAt: Date.now(),
    };
    const next = [...templates, tpl];
    setTemplates(next);
    setSelectedTemplateId(tpl.id);
    saveTemplates(storage, storageKey, next);
  }, [templates, headers, mapping, storage, storageKey]);

  const handleDeleteTemplate = useCallback(() => {
    if (!selectedTemplateId) return;
    const next = templates.filter((t) => t.id !== selectedTemplateId);
    setTemplates(next);
    setSelectedTemplateId(null);
    saveTemplates(storage, storageKey, next);
  }, [templates, selectedTemplateId, storage, storageKey]);

  const handleCorrect = useCallback((rowIdx: number, csvIdx: number, value: string) => {
    setCorrections((prev) => {
      const next = { ...prev };
      const row = { ...(next[rowIdx] ?? {}) };
      const original = rows[rowIdx]?.[csvIdx] ?? '';
      if (value === original) {
        delete row[csvIdx];
      } else {
        row[csvIdx] = value;
      }
      if (Object.keys(row).length === 0) delete next[rowIdx];
      else next[rowIdx] = row;
      return next;
    });
  }, [rows]);

  const missingRequired = useMemo(() => {
    const mapped = new Set(Object.values(mapping));
    return fields.filter((f) => f.required && !mapped.has(f.name));
  }, [fields, mapping]);

  const handleFileLoaded = useCallback((h: string[], r: string[][]) => {
    setHeaders(h); setRows(r); setMapping(autoMapColumns(h, fields, r)); setCorrections({}); setStep('mapping');
  }, [fields]);

  // Per-column type guesses, sampled from the loaded rows — drives mapping hints.
  const inferredTypes = useMemo<InferredType[]>(
    () => headers.map((_, idx) => inferColumnType(rows.map((r) => r[idx]))),
    [headers, rows],
  );

  const handleImport = useCallback(async () => {
    setImporting(true); setProgress(0);
    const errors: ImportResult['errors'] = [];
    let importedRows = 0, skippedRows = 0;
    const mappedCols = Object.entries(mapping).map(([idx, name]) => ({
      csvIdx: Number(idx), field: fields.find((f) => f.name === name)!,
    }));

    for (let i = 0; i < rows.length; i++) {
      // Apply inline corrections (only available for the visible preview rows)
      // before validation so users can fix issues without re-uploading the file.
      const original = rows[i];
      const fixes = corrections[i];
      const effectiveRow = fixes
        ? original.map((v, idx) => (fixes[idx] !== undefined ? fixes[idx] : v))
        : original;

      const { record, errors: rowErrors } = validateRow(effectiveRow, mappedCols, i + 1);
      if (rowErrors.length > 0) {
        skippedRows++;
        errors.push(...rowErrors);
        if (onErrorMode === 'stop') break;
      } else {
        try { if (dataSource?.create) await dataSource.create(objectName, record); importedRows++; }
        catch (err) {
          skippedRows++;
          const msg = err instanceof Error ? err.message : 'Failed to create record';
          errors.push({ row: i + 1, field: '', message: msg });
          if (onErrorMode === 'stop') break;
        }
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    const importResult: ImportResult = { totalRows: rows.length, importedRows, skippedRows, errors };
    setResult(importResult); setImporting(false); onComplete?.(importResult);
  }, [rows, mapping, fields, dataSource, objectName, onComplete, onErrorMode, corrections]);

  const reset = useCallback(() => {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setProgress(0); setResult(null);
    setCorrections({}); setSelectedTemplateId(null);
  }, []);

  const handleClose = useCallback(() => { reset(); onOpenChange?.(false); onCancel?.(); }, [reset, onOpenChange, onCancel]);
  const { t } = useImportTranslation();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange?.(v); }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> {t('grid.import.title', { object: label })}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && t('grid.import.uploadDescription')}
            {step === 'mapping' && t('grid.import.mappingDescription')}
            {step === 'preview' && t('grid.import.previewDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {(['upload', 'mapping', 'preview'] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <ArrowRight className="h-3 w-3" />}
              <span className={cn('rounded-full px-3 py-1', step === s ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {i + 1}. {s === 'upload' ? t('grid.import.stepUpload') : s === 'mapping' ? t('grid.import.stepMapping') : t('grid.import.stepPreview')}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
        {!result ? (
          <>
            {step === 'upload' && <StepUpload onFileLoaded={handleFileLoaded} />}
            {step === 'mapping' && (
              <StepMapping
                headers={headers}
                fields={fields}
                mapping={mapping}
                onMappingChange={setMapping}
                inferredTypes={inferredTypes}
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={handleSelectTemplate}
                onSaveTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
              />
            )}
            {step === 'preview' && (
              <StepPreview
                headers={headers}
                rows={rows}
                mapping={mapping}
                fields={fields}
                corrections={corrections}
                onCorrect={handleCorrect}
              />
            )}
            {importing && (
              <div className="flex flex-col gap-1">
                <Progress value={progress} className="h-2" />
                <p className="text-center text-xs text-muted-foreground">{t('grid.import.importing', { progress })}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-lg font-semibold">{t('grid.import.importComplete')}</p>
            <div className="flex gap-3">
              <Badge variant="default">{t('grid.import.imported', { count: result.importedRows })}</Badge>
              {result.skippedRows > 0 && <Badge variant="destructive">{t('grid.import.skippedCount', { count: result.skippedRows })}</Badge>}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-32 w-full overflow-auto rounded border p-2 text-xs">
                {result.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-destructive">Row {err.row}{err.field ? ` (${err.field})` : ''}: {err.message}</p>
                ))}
                {result.errors.length > 10 && <p className="text-muted-foreground">{t('grid.import.moreErrors', { count: result.errors.length - 10 })}</p>}
              </div>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {result ? (
            <Button onClick={handleClose}>{t('grid.import.close')}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={importing}><X className="mr-1 h-4 w-4" /> {t('grid.import.cancel')}</Button>
              {(step === 'mapping' || step === 'preview') && (
                <Button variant="outline" onClick={() => setStep(step === 'mapping' ? 'upload' : 'mapping')} disabled={importing}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> {t('grid.import.back')}
                </Button>
              )}
              {step === 'mapping' && (
                <Button onClick={() => setStep('preview')} disabled={Object.keys(mapping).length === 0 || missingRequired.length > 0}>
                  {t('grid.import.next')} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              {step === 'preview' && (
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? t('grid.import.importingProgress') : t('grid.import.importNRows', { count: rows.length })}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
