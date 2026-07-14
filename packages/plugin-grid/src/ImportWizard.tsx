/**
 * ObjectUI – Copyright (c) 2024-present ObjectStack Inc.
 * Licensed under MIT. Phase 15 L1: CSV/Excel Import Wizard
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  cn, Button, Badge, Progress, Input, Checkbox, Label,
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@object-ui/components';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowRight, ArrowLeft, Save, Trash2, ClipboardPaste, Download, Undo2 } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/react';
import { sanitizeFileNameBase } from '@object-ui/core';
import type {
  DataSource,
  ImportRequestOptions,
  ImportRecordsResult,
  ImportRowResult,
  ImportWriteMode,
  CreateImportJobResult,
  ImportJobProgressInfo,
  ImportJobResultsInfo,
  ImportJobStatus,
  ImportJobSummaryInfo,
} from '@object-ui/types';
import {
  parseSpreadsheetFile, parseClipboardTable, inferColumnType, isTypeCompatible,
  suggestColumnMappings, ImportParseError,
  type InferredType, type ColumnSuggestion, type MappingConfidence,
} from './importParsers';
import {
  asSavedMapping, buildSourceRows, summarizeSavedMapping, savedMappingToDisplayIndexMap,
  type SavedMapping,
} from './savedMapping';

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
  'grid.import.downloadTemplate': 'Download template',
  'grid.import.downloadTemplateHint': 'Get a CSV with the right columns (required fields marked *).',
  'grid.import.templateFileName': '{{object}}-import-template',
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
  'grid.import.savedMapping': 'Saved mapping:',
  'grid.import.chooseSavedMapping': 'Choose a saved mapping…',
  'grid.import.manualMapping': '— Map columns manually —',
  'grid.import.transform': 'Transform',
  'grid.import.savedMappingHint': "Mapping “{{name}}” applies rename + transforms + type coercion on the server. Column mapping is read-only.",
  'grid.import.savedMappingPreviewNote': "The preview shows your source columns; on import, mapping “{{name}}” applies rename, transforms and type coercion on the server.",
  'grid.import.csvColumn': 'Column',
  'grid.import.mapsTo': 'Maps To',
  'grid.import.typeMismatch': 'Looks like {{type}}',
  'grid.import.autoMatched': 'Auto-matched',
  'grid.import.autoMatchedSummary': 'Auto-matched {{count}} column(s) — review and adjust below.',
  'grid.import.confidence.high': 'High confidence',
  'grid.import.confidence.medium': 'Medium confidence',
  'grid.import.confidence.low': 'Low confidence',
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
  // Async (large-file) import — job queued + processed server-side.
  'grid.import.asyncQueued': 'Queued — preparing to import…',
  'grid.import.asyncProcessing': 'Importing {{processed}} of {{total}} rows… {{progress}}%',
  'grid.import.asyncLargeHint': 'This file is large, so it will be imported in the background.',
  'grid.import.largeSampleNotice': 'Previewing the first {{shown}} of {{total}} rows.',
  'grid.import.cancelImport': 'Cancel import',
  'grid.import.importCancelled': 'Import cancelled',
  'grid.import.resultsTruncated': 'Showing the first {{count}} row results (of {{total}}).',
  'grid.import.importComplete': 'Import Complete',
  'grid.import.imported': '{{count}} imported',
  'grid.import.createdCount': '{{count}} created',
  'grid.import.updatedCount': '{{count}} updated',
  'grid.import.skippedCount': '{{count}} skipped',
  'grid.import.moreErrors': '…and {{count}} more errors',
  'grid.import.downloadFailed': 'Download failed rows',
  // Write-mode / options (preview step)
  'grid.import.options': 'Import options',
  'grid.import.writeMode': 'When a row matches an existing record',
  'grid.import.writeModeOpt.insert': 'Always create new',
  'grid.import.writeModeOpt.update': 'Update existing (skip if no match)',
  'grid.import.writeModeOpt.upsert': 'Update if matched, else create',
  'grid.import.matchFields': 'Match on',
  'grid.import.matchFieldsPlaceholder': 'Choose match field(s)…',
  'grid.import.matchFieldsHint': 'Rows are matched to existing records by these field(s).',
  'grid.import.needMatchFields': 'Select at least one field to match on.',
  'grid.import.optCreateOptions': 'Keep unknown option values',
  'grid.import.optRunAutomations': 'Run automations & triggers',
  'grid.import.optSkipBlankKey': 'Skip rows with a blank match value',
  'grid.import.optBackground': 'Import in the background',
  'grid.import.optBackgroundHint': '(runs as an undoable job)',
  // Server dry-run pre-check (small files, preview step)
  'grid.import.validate': 'Validate data',
  'grid.import.validating': 'Validating…',
  'grid.import.validateHint': 'Check every row against the server before importing.',
  'grid.import.validatePassed': 'All {{ok}} rows are valid.',
  'grid.import.validateFailed': '{{ok}} valid, {{errors}} with errors.',
  'grid.import.errorRowPrefix': 'Row {{row}}: ',
  // Friendly, localized renderings of the server's structured import errors.
  'grid.import.referenceNotFound': 'No matching record for "{{value}}"',
  'grid.import.referenceAmbiguous': '"{{value}}" matches more than one record — use a unique value or the record id',
  // Import-job history
  'grid.import.history': 'History',
  'grid.import.historyBack': 'Back to import',
  'grid.import.historyDescription': 'Recent imports for this object.',
  'grid.import.historyHint': 'Background import jobs, newest first.',
  'grid.import.historyRefresh': 'Refresh',
  'grid.import.historyLoading': 'Loading…',
  'grid.import.historyEmpty': 'No imports yet.',
  'grid.import.historyUnsupported': 'Import history isn’t available for this data source.',
  'grid.import.historyColStatus': 'Status',
  'grid.import.historyColRows': 'Rows',
  'grid.import.historyColResult': 'Result',
  'grid.import.historyColTime': 'When',
  'grid.import.errorCount': '{{count}} errors',
  // Undo / logical rollback
  'grid.import.undoImport': 'Undo import',
  'grid.import.undoing': 'Undoing…',
  'grid.import.undoConfirm': 'Undo this import? Records it created will be deleted and records it updated will be restored to their previous values.',
  'grid.import.reverted': 'Undone',
  'grid.import.jobStatus.pending': 'Pending',
  'grid.import.jobStatus.running': 'Running',
  'grid.import.jobStatus.succeeded': 'Succeeded',
  'grid.import.jobStatus.failed': 'Failed',
  'grid.import.jobStatus.cancelled': 'Cancelled',
  'grid.import.cancel': 'Cancel',
  'grid.import.back': 'Back',
  'grid.import.next': 'Next',
  'grid.import.close': 'Close',
  'grid.import.importNRows': 'Import {{count}} Rows',
  'grid.import.importingProgress': 'Importing…',
  'grid.import.required': 'Required',
  'grid.import.invalidType': 'Invalid {{type}}',
  'grid.import.legacyReferenceBlocked': 'Import blocked: {{fields}} are relation fields that need the server import route to resolve names into record IDs, and this connection doesn’t support it. Importing them as plain text would corrupt the data. Upgrade the backend/client, or unmap these columns and import them separately.',
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
  get isUnsupportedImport() { return isUnsupportedImport; },
  get mappedReferenceFields() { return mappedReferenceFields; },
  get formatDryRunError() { return formatDryRunError; },
  get isUnsupportedImportJob() { return isUnsupportedImportJob; },
  get jobResultToImportResult() { return jobResultToImportResult; },
  get buildFailedRowsCsv() { return buildFailedRowsCsv; },
  get buildImportTemplateCsv() { return buildImportTemplateCsv; },
  get assembleImportRequest() { return assembleImportRequest; },
  get isImportJobActive() { return isImportJobActive; },
  get isImportJobUndoable() { return isImportJobUndoable; },
  get buildSourceRows() { return buildSourceRows; },
  get summarizeSavedMapping() { return summarizeSavedMapping; },
  get savedMappingToDisplayIndexMap() { return savedMappingToDisplayIndexMap; },
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
  fields: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    /** Allowed values for select/enum fields — used to seed the downloadable
     *  template's example row. Accepts option objects or bare strings. */
    options?: Array<{ label?: string; value?: string | number } | string>;
  }>;
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
  /** Registered server-side import mappings for this object (framework #2611).
   *  When omitted, the wizard fetches them via `dataSource.listImportMappings`
   *  (feature-detected). Pass explicitly to override / for tests. */
  savedMappings?: SavedMapping[];
  /** Pre-loaded spreadsheet (cloud#797 Excel→App): when the wizard opens with
   *  this set, it parses the File in memory and jumps straight to the mapping
   *  step, skipping the upload UI. Used by the AI build panel to hand off an
   *  already-attached Excel/CSV so the user goes from "one sentence → app" to
   *  "my real data is in it" without re-picking the file. Ignored on reopen
   *  once consumed. */
  initialFile?: File;
  /** Extra content rendered above the write-options panel on the preview step.
   *  Hosts inject domain-specific import options here (e.g. the identity
   *  import's password policy — framework#2782); any state it collects flows
   *  back through the host's own `dataSource` wrapper, so the wizard stays
   *  backend-agnostic. */
  extraOptionsContent?: React.ReactNode;
  /** Render extra content at the top of the result step — e.g. one-time
   *  credentials a domain-specific import endpoint returned in
   *  `result.serverResult` (framework#2782). */
  renderResultExtra?: (result: ImportResult) => React.ReactNode;
}

export interface ImportResult {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  /** Rows that created a new record (server-side import). */
  createdRows?: number;
  /** Rows that updated an existing record (server-side import). */
  updatedRows?: number;
  /** The raw per-row server result, when the server `/import` path was used. */
  serverResult?: ImportRecordsResult;
  /** True when an async job's per-row `errors` were capped by the server. */
  resultsTruncated?: boolean;
  /** True when the user cancelled an in-flight async import job. */
  cancelled?: boolean;
}

type WizardStep = 'upload' | 'mapping' | 'preview';

/** Maximum number of rows to show in the preview step */
const PREVIEW_ROW_COUNT = 10;

/**
 * Row count above which the wizard prefers an asynchronous import job (when the
 * data source supports it) instead of the synchronous single-call import. Kept
 * in step with the server's synchronous `/import` ceiling (`maxRows: 5000`), so
 * files the sync route would reject with 413 are routed to a background job.
 */
const ASYNC_IMPORT_THRESHOLD = 5000;

/** How often (ms) to poll an in-flight import job for progress. */
const IMPORT_JOB_POLL_INTERVAL = 800;

/** Text colour for the auto-match confidence hint, keyed by confidence bucket. */
const CONFIDENCE_CLASS: Record<MappingConfidence, string> = {
  high: 'text-emerald-600',
  medium: 'text-sky-600',
  low: 'text-muted-foreground',
};

/** Boolean tokens the server's import coercion accepts (import-coerce.ts).
 *  Kept in sync so the preview step doesn't flag a cell the server would take
 *  (e.g. Chinese 是/否, on/off, ✓/×). Compared case-insensitively. */
const BOOLEAN_IMPORT_TOKENS = new Set([
  'true', 't', 'yes', 'y', '1', 'on', '是', '对', '✓', '√',
  'false', 'f', 'no', 'n', '0', 'off', '否', '错', '✗', '×',
]);

/** Field types the server resolves from display text to record IDs during
 *  `/import` (kept in step with the server's import-coerce REFERENCE_TYPES).
 *  The legacy per-row create fallback has no resolution step — raw cell text
 *  would be stored verbatim into relation fields — so the fallback must refuse
 *  to run when any mapped column targets one of these types. */
const REFERENCE_IMPORT_TYPES = new Set(['lookup', 'master_detail', 'user', 'reference', 'tree']);

/** Mapped fields whose type the legacy fallback cannot import safely. */
function mappedReferenceFields(
  mapping: Record<number, string>,
  fields: ImportWizardProps['fields'],
): ImportWizardProps['fields'] {
  const mappedNames = new Set(Object.values(mapping));
  return fields.filter((f) => mappedNames.has(f.name) && REFERENCE_IMPORT_TYPES.has(f.type));
}

/** Pull the first double-quoted token out of a server error message — e.g.
 *  `no os_..._product matches "导管架"` → `导管架`. A locale-agnostic fallback for
 *  naming the offending value when it can't be read back from the row. */
function extractQuotedValue(message?: string): string | undefined {
  const m = message?.match(/"([^"]*)"/);
  return m?.[1];
}

/**
 * Turn one failed dry-run row into a friendly, localizable error line.
 *
 * The server keys each error by a field's api-name, bakes that same api-name
 * into an English message (`product: no os_..._product matches "..."`), and
 * tags it with a structured `code`. Rendered verbatim that reads as
 * `产品: product: no os_..._product matches "..."` — the field twice, an
 * internal object name, all in English. So we drive the message off `code`
 * (localized, with the offending value), resolve the api-name to its human
 * label, and only fall back to the raw server text — minus any duplicated
 * `<api-name>:` prefix — for codes we don't recognize.
 */
function formatDryRunError(
  r: Pick<ImportRowResult, 'field' | 'error' | 'code'>,
  fieldLabelByName: Map<string, string>,
  value: string | undefined,
  t: (key: string, vars?: Record<string, unknown>) => string,
): { fieldLabel?: string; message: string } {
  const fieldLabel = r.field ? (fieldLabelByName.get(r.field) ?? r.field) : undefined;
  // Prefer the value the row actually supplied; fall back to the token the
  // server echoed into its message.
  const shown = (value ?? '').trim() || extractQuotedValue(r.error) || '';
  switch (r.code) {
    case 'reference_not_found':
      return { fieldLabel, message: t('grid.import.referenceNotFound', { value: shown }) };
    case 'reference_ambiguous':
      return { fieldLabel, message: t('grid.import.referenceAmbiguous', { value: shown }) };
  }
  let message = (r.error ?? r.code ?? '').trim();
  // Drop a leading `<api-name>:` the server prepended, so it isn't shown on top
  // of the label we render.
  if (r.field && message.toLowerCase().startsWith(`${r.field.toLowerCase()}:`)) {
    message = message.slice(r.field.length + 1).trimStart();
  }
  return { fieldLabel, message };
}

function validateValue(value: string, type: string): boolean {
  if (!value) return true;
  switch (type) {
    case 'number': case 'currency': case 'percent': return !isNaN(Number(value));
    case 'boolean': return BOOLEAN_IMPORT_TOKENS.has(value.trim().toLowerCase());
    case 'date': case 'datetime': return !isNaN(Date.parse(value));
    default: return true;
  }
}

/**
 * Auto-map source columns to object fields, Airtable-style. Delegates to
 * {@link suggestColumnMappings} (name/label similarity + bilingual synonyms +
 * token overlap + content-inferred type gating, assigned globally by
 * confidence) and keeps only the confidently-matched columns. `rows` is
 * optional; without it only name-based signals fire.
 */
function autoMapColumns(
  headers: string[],
  fields: ImportWizardProps['fields'],
  rows?: string[][],
): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (const s of suggestColumnMappings(headers, fields, rows)) {
    if (s.fieldName) mapping[s.columnIndex] = s.fieldName;
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

/** Assemble the server `/import` request from mapping-applied raw rows plus the
 *  current write-mode + coercion options. Kept pure (no component state) so the
 *  real import and the dry-run pre-check send byte-identical payloads and it can
 *  be unit-tested. `matchFields` is only sent when the write-mode consults it. */
function assembleImportRequest(
  rows: Record<string, string>[],
  opts: {
    writeMode: ImportWriteMode;
    matchFields: string[];
    createMissingOptions: boolean;
    runAutomations: boolean;
    skipBlankMatchKey: boolean;
    dryRun?: boolean;
    /** When set, the server resolves this registered mapping and owns the
     *  rename + transform + write semantics (framework #2611). `rows` must
     *  then carry SOURCE headers (see buildSourceRows), and the inline
     *  column mapping / write-mode are omitted — mutually exclusive per the
     *  server contract. `runAutomations` is still honored. */
    mappingName?: string;
  },
): ImportRequestOptions {
  if (opts.mappingName) {
    return {
      format: 'json',
      rows,
      mappingName: opts.mappingName,
      runAutomations: opts.runAutomations,
      ...(opts.dryRun ? { dryRun: true } : {}),
    };
  }
  return {
    format: 'json',
    rows,
    writeMode: opts.writeMode,
    ...(opts.writeMode !== 'insert' ? { matchFields: opts.matchFields } : {}),
    createMissingOptions: opts.createMissingOptions,
    runAutomations: opts.runAutomations,
    skipBlankMatchKey: opts.skipBlankMatchKey,
    ...(opts.dryRun ? { dryRun: true } : {}),
  };
}

/** True when the adapter/client can't speak the server `/import` route, so the
 *  wizard should transparently fall back to a per-row `create` loop. */
function isUnsupportedImport(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (code === 'UNSUPPORTED_OPERATION') return true;
  const msg = err instanceof Error ? err.message : '';
  return /does not support data\.import|importRecords is not a function|\.import is not a function/i.test(msg);
}

/** True when the data source lacks the async import-job API (older
 *  adapter/client/server), so the wizard should fall back to the sync path. */
function isUnsupportedImportJob(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (code === 'UNSUPPORTED_OPERATION') return true;
  const msg = err instanceof Error ? err.message : '';
  return /does not support async import|createImportJob is not a function|import\/jobs|404/i.test(msg);
}

/** Map an async import-job's final results payload onto the wizard's
 *  {@link ImportResult} shape — identical to the synchronous mapping so the
 *  completion screen renders the same regardless of which path ran. */
function jobResultToImportResult(res: ImportJobResultsInfo): ImportResult {
  return {
    totalRows: res.total,
    importedRows: res.created + res.updated,
    skippedRows: res.skipped + res.errors,
    createdRows: res.created,
    updatedRows: res.updated,
    errors: (res.results ?? [])
      .filter((r) => !r.ok)
      .map((r) => ({ row: r.row, field: r.field ?? '', message: r.error ?? r.code ?? 'Import failed' })),
    resultsTruncated: res.resultsTruncated,
  };
}

/** True while an import job is still in flight — it can be cancelled and the
 *  history list should keep polling it. Terminal states are the rest. */
function isImportJobActive(status: ImportJobStatus): boolean {
  return status === 'pending' || status === 'running';
}

/** Whether to show the "Undo import" button for a history row: the adapter must
 *  support undo, the job must be terminal, still undoable, and not already
 *  reverted. Mirrors the server's `importJobUndoable`. */
function isImportJobUndoable(job: Pick<ImportJobSummaryInfo, 'status' | 'undoable' | 'revertedAt'>, canUndo: boolean): boolean {
  return canUndo && !!job.undoable && !job.revertedAt && !isImportJobActive(job.status);
}

/** Build a CSV blob of failed rows for re-export: the original mapped columns
 *  plus an `_error` column, so a user can fix and re-import just the failures. */
function buildFailedRowsCsv(
  headers: string[],
  rows: string[][],
  mapping: Record<number, string>,
  errorsByRow: Map<number, string>,
): string {
  const cols = Object.keys(mapping).map(Number).sort((a, b) => a - b);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = [...cols.map((c) => headers[c] ?? `col${c}`), '_error'];
  const lines = [head.map(esc).join(',')];
  // errorsByRow is keyed by 1-based row number.
  for (const [rowNum, message] of errorsByRow) {
    const src = rows[rowNum - 1];
    if (!src) continue;
    lines.push([...cols.map((c) => esc(src[c] ?? '')), esc(message)].join(','));
  }
  return lines.join('\n');
}

/** Pick a representative allowed value from a select field's options, for the
 *  template example row. Prefers the display label over the stored value: the
 *  server's import coercion accepts either (it matches value OR label,
 *  case-insensitively), and the label is what a localized user recognizes —
 *  an ASCII slug like `prepare` reads as English leakage in a zh template. */
function firstOptionValue(
  options: ImportWizardProps['fields'][number]['options'],
): string | undefined {
  const first = options?.[0];
  if (first === undefined || first === null) return undefined;
  if (typeof first === 'string') return first;
  if (first.label) return first.label;
  if (first.value !== undefined && first.value !== null) return String(first.value);
  return undefined;
}

/** A type-appropriate example cell for the downloadable import template. Kept
 *  format-oriented (dates, emails) rather than prose so it reads the same in
 *  any locale; text-ish fields are left blank so the row is obviously a sample. */
function exampleForField(field: ImportWizardProps['fields'][number]): string {
  switch (field.type) {
    case 'number':
    case 'currency':
    case 'percent':
      return '0';
    case 'date':
      return '2024-01-31';
    case 'datetime':
      return '2024-01-31 09:00';
    case 'time':
      return '09:00';
    case 'boolean':
      return 'true';
    case 'email':
      return 'name@example.com';
    case 'url':
      return 'https://example.com';
    case 'select':
    case 'multiselect':
    case 'lookup':
    case 'reference':
      return firstOptionValue(field.options) ?? '';
    default:
      return '';
  }
}

/** Build a downloadable CSV import template for the given fields: a header row
 *  of field labels (required fields marked with `*`, which re-import tolerates)
 *  plus a single example row. Not persisted — a convenience starting point. */
function buildImportTemplateCsv(fields: ImportWizardProps['fields']): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = fields.map((f) => `${f.label}${f.required ? ' *' : ''}`);
  const example = fields.map((f) => exampleForField(f));
  return [header.map(esc).join(','), example.map(esc).join(',')].join('\n');
}

/** Trigger a client-side text file download (prepends a UTF-8 BOM so Excel
 *  reads non-ASCII correctly). No-op in non-DOM environments. */
function downloadTextFile(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return;
  const blob = new Blob([`﻿${text}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Map a thrown import-parse error code to a translated, user-facing message. */
function parseErrorMessage(err: unknown, t: (k: string, v?: Record<string, unknown>) => string): string {
  const code = err instanceof Error ? err.message : '';
  if (code === ImportParseError.LegacyXls) return t('grid.import.legacyXls');
  if (code === ImportParseError.Unsupported) return t('grid.import.unsupportedFile');
  return t('grid.import.parseFailed');
}

// Step 1: File Upload (CSV / Excel / paste)
const StepUpload: React.FC<{
  onFileLoaded: (headers: string[], rows: string[][]) => void;
  fields: ImportWizardProps['fields'];
  objectName: string;
  /** Localized display label — used for the template filename so a zh user
   *  downloads `合同-导入模板.csv` rather than `contracts-template.csv`. */
  objectLabel?: string;
}> = ({ onFileLoaded, fields, objectName, objectLabel }) => {
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
      {fields.length > 0 && (
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const base = sanitizeFileNameBase(
                t('grid.import.templateFileName', { object: objectLabel || objectName || 'import' }),
              );
              downloadTextFile(`${base || 'import-template'}.csv`, buildImportTemplateCsv(fields));
            }}
            data-testid="import-download-template"
          >
            <Download className="mr-1 h-4 w-4" /> {t('grid.import.downloadTemplate')}
          </Button>
          <p className="text-xs text-muted-foreground/70">{t('grid.import.downloadTemplateHint')}</p>
        </div>
      )}
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

/** Selector for a registered server-side import mapping (framework #2611).
 *  Picking one hands rename + transforms to the server; the manual column
 *  table is replaced by a read-only summary of the artifact. */
const SavedMappingBar: React.FC<{
  mappings: SavedMapping[];
  activeName: string | null;
  onSelect: (name: string) => void;
  onClear: () => void;
}> = ({ mappings, activeName, onSelect, onClear }) => {
  const { t } = useImportTranslation();
  if (mappings.length === 0) return null;
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
      data-testid="import-saved-mapping-bar"
    >
      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">{t('grid.import.savedMapping')}</span>
      <Select value={activeName ?? '__none__'} onValueChange={(v) => (v === '__none__' ? onClear() : onSelect(v))}>
        <SelectTrigger className="h-7 w-56 text-xs" data-testid="import-saved-mapping-select">
          <SelectValue placeholder={t('grid.import.chooseSavedMapping')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t('grid.import.manualMapping')}</SelectItem>
          {mappings.map((m) => (
            <SelectItem key={m.name} value={m.name}>{m.label || m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/** Read-only summary of the chosen server mapping — source → target (transform)
 *  per fieldMapping entry. Names the transforms without re-running them. */
const SavedMappingSummary: React.FC<{ mapping: SavedMapping }> = ({ mapping }) => {
  const { t } = useImportTranslation();
  const rows = summarizeSavedMapping(mapping);
  return (
    <div data-testid="import-saved-mapping-summary">
      <p className="mb-2 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('grid.import.savedMappingHint', { name: mapping.label || mapping.name })}</span>
      </p>
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('grid.import.csvColumn')}</TableHead>
              <TableHead>{t('grid.import.mapsTo')}</TableHead>
              <TableHead className="w-32 text-center">{t('grid.import.transform')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.source}</TableCell>
                <TableCell>{r.target}</TableCell>
                <TableCell className="text-center">
                  {r.transform
                    ? <Badge variant="outline" className="text-[10px] font-normal">{r.transform}</Badge>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
  suggestions: ColumnSuggestion[];
  templates: ImportMappingTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onSaveTemplate: (name: string) => void;
  onDeleteTemplate: () => void;
  savedMappings: SavedMapping[];
  activeMapping: SavedMapping | null;
  onSelectSavedMapping: (name: string) => void;
  onClearSavedMapping: () => void;
}> = ({ headers, fields, mapping, onMappingChange, inferredTypes, suggestions, templates, selectedTemplateId, onSelectTemplate, onSaveTemplate, onDeleteTemplate, savedMappings, activeMapping, onSelectSavedMapping, onClearSavedMapping }) => {
  const { t } = useImportTranslation();
  const usedFields = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const suggestionByCol = useMemo(() => {
    const m = new Map<number, ColumnSuggestion>();
    suggestions.forEach((s) => m.set(s.columnIndex, s));
    return m;
  }, [suggestions]);
  // How many columns were auto-matched (vs. the current, possibly-edited mapping).
  const autoMatchedCount = useMemo(() => {
    let n = 0;
    suggestionByCol.forEach((s, idx) => { if (s.fieldName && mapping[idx] === s.fieldName) n++; });
    return n;
  }, [suggestionByCol, mapping]);
  const handleChange = useCallback((colIdx: number, fieldName: string) => {
    const next = { ...mapping };
    if (fieldName === '__skip__') delete next[colIdx]; else next[colIdx] = fieldName;
    onMappingChange(next);
  }, [mapping, onMappingChange]);

  return (
    <div>
      <SavedMappingBar
        mappings={savedMappings}
        activeName={activeMapping?.name ?? null}
        onSelect={onSelectSavedMapping}
        onClear={onClearSavedMapping}
      />
      {activeMapping ? (
        <SavedMappingSummary mapping={activeMapping} />
      ) : (
      <>
      <TemplateBar
        templates={templates}
        selectedId={selectedTemplateId}
        onSelect={onSelectTemplate}
        onSaveAs={onSaveTemplate}
        onDelete={onDeleteTemplate}
        disabled={Object.keys(mapping).length === 0}
      />
      {autoMatchedCount > 0 && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="import-automatch-summary">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          {t('grid.import.autoMatchedSummary', { count: String(autoMatchedCount) })}
        </p>
      )}
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
            const suggestion = suggestionByCol.get(idx);
            // Badge only while the user's choice still matches what we auto-suggested.
            const autoMatched = !!suggestion?.fieldName && mapping[idx] === suggestion.fieldName
              ? suggestion.confidence : null;
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
                {autoMatched && (
                  <p className={cn('mt-1 flex items-center gap-1 text-[11px]', CONFIDENCE_CLASS[autoMatched])} data-testid={`import-automatch-${idx}`}>
                    <CheckCircle2 className="h-3 w-3" /> {t('grid.import.autoMatched')} · {t(`grid.import.confidence.${autoMatched}`)}
                  </p>
                )}
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
      </>
      )}
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
            {mappedCols.map((col) => (
              <TableHead key={col.csvIdx} className="min-w-[140px] whitespace-nowrap">{col.field.label}</TableHead>
            ))}
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

/** Options controlling how the server commits each row (insert/update/upsert
 *  + toggles). Rendered above the preview so the choices are visible before the
 *  import runs. */
const ImportOptions: React.FC<{
  fields: ImportWizardProps['fields'];
  mapping: Record<number, string>;
  writeMode: ImportWriteMode;
  onWriteMode: (m: ImportWriteMode) => void;
  matchFields: string[];
  onToggleMatchField: (name: string) => void;
  createMissingOptions: boolean;
  onCreateMissingOptions: (v: boolean) => void;
  runAutomations: boolean;
  onRunAutomations: (v: boolean) => void;
  skipBlankMatchKey: boolean;
  onSkipBlankMatchKey: (v: boolean) => void;
  showBackground: boolean;
  backgroundImport: boolean;
  onBackgroundImport: (v: boolean) => void;
}> = ({
  fields, mapping, writeMode, onWriteMode, matchFields, onToggleMatchField,
  createMissingOptions, onCreateMissingOptions, runAutomations, onRunAutomations,
  skipBlankMatchKey, onSkipBlankMatchKey,
  showBackground, backgroundImport, onBackgroundImport,
}) => {
  const { t } = useImportTranslation();
  // Only fields that are actually mapped can serve as match keys.
  const mappedFieldNames = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const matchable = useMemo(() => fields.filter((f) => mappedFieldNames.has(f.name)), [fields, mappedFieldNames]);
  const needsMatch = writeMode !== 'insert';

  return (
    <div className="mb-3 rounded-md border bg-muted/30 p-3" data-testid="import-options">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('grid.import.options')}</p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t('grid.import.writeMode')}</Label>
          <Select value={writeMode} onValueChange={(v) => onWriteMode(v as ImportWriteMode)}>
            <SelectTrigger className="h-8 w-72 text-xs" data-testid="import-writemode-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="insert">{t('grid.import.writeModeOpt.insert')}</SelectItem>
              <SelectItem value="update">{t('grid.import.writeModeOpt.update')}</SelectItem>
              <SelectItem value="upsert">{t('grid.import.writeModeOpt.upsert')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {needsMatch && (
          <div className="flex flex-col gap-1.5" data-testid="import-matchfields">
            <Label className="text-xs">{t('grid.import.matchFields')}</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {matchable.length === 0 && (
                <span className="text-[11px] text-muted-foreground">{t('grid.import.matchFieldsPlaceholder')}</span>
              )}
              {matchable.map((f) => (
                <label key={f.name} className="flex items-center gap-1.5 text-xs" data-testid={`import-matchfield-${f.name}`}>
                  <Checkbox
                    checked={matchFields.includes(f.name)}
                    onCheckedChange={() => onToggleMatchField(f.name)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <p className={cn('text-[11px]', matchFields.length === 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {matchFields.length === 0 ? t('grid.import.needMatchFields') : t('grid.import.matchFieldsHint')}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-xs" data-testid="import-opt-create-options">
            <Checkbox checked={createMissingOptions} onCheckedChange={(v) => onCreateMissingOptions(v === true)} />
            {t('grid.import.optCreateOptions')}
          </label>
          {needsMatch && (
            <label className="flex items-center gap-2 text-xs" data-testid="import-opt-skip-blank">
              <Checkbox checked={skipBlankMatchKey} onCheckedChange={(v) => onSkipBlankMatchKey(v === true)} />
              {t('grid.import.optSkipBlankKey')}
            </label>
          )}
          <label className="flex items-center gap-2 text-xs" data-testid="import-opt-run-automations">
            <Checkbox checked={runAutomations} onCheckedChange={(v) => onRunAutomations(v === true)} />
            {t('grid.import.optRunAutomations')}
          </label>
          {showBackground && (
            <label className="flex items-center gap-2 text-xs" data-testid="import-opt-background">
              <Checkbox checked={backgroundImport} onCheckedChange={(v) => onBackgroundImport(v === true)} />
              <span>
                {t('grid.import.optBackground')}
                <span className="ml-1 text-[11px] text-muted-foreground">{t('grid.import.optBackgroundHint')}</span>
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
};

/** Colour intent for each import-job status badge. */
const IMPORT_JOB_STATUS_VARIANT: Record<ImportJobStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  running: 'secondary',
  succeeded: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

/** Format an ISO timestamp compactly for the history table; falls back to the
 *  raw string (or a dash) when it isn't a parseable date. */
function formatImportJobTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/**
 * Import-job history for one object: lists prior async jobs (status, counts,
 * time), lets the user cancel an in-flight job, and refresh. Degrades to an
 * empty state when the data source lacks `listImportJobs` (older adapter).
 */
const ImportHistoryPanel: React.FC<{
  objectName: string;
  dataSource: unknown;
  t: (key: string, vars?: Record<string, unknown>) => string;
}> = ({ objectName, dataSource, t }) => {
  const [jobs, setJobs] = useState<ImportJobSummaryInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Job id currently being undone (disables its row's Undo button + confirm).
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const ds = dataSource as Partial<DataSource> | undefined;
  const supported = typeof ds?.listImportJobs === 'function';
  const canUndo = typeof ds?.undoImportJob === 'function';

  const load = useCallback(async () => {
    if (typeof ds?.listImportJobs !== 'function') return;
    setLoading(true); setError(null);
    try {
      const list = await ds.listImportJobs({ object: objectName, limit: 50 });
      setJobs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [ds, objectName]);

  useEffect(() => { void load(); }, [load]);

  const handleCancel = useCallback(async (jobId: string) => {
    if (typeof ds?.cancelImportJob !== 'function') return;
    try { await ds.cancelImportJob(jobId); } catch { /* best-effort */ }
    void load();
  }, [ds, load]);

  // Logical rollback: delete created records + restore updated ones. Confirms
  // first (destructive + irreversible), then reloads so the row flips to
  // "reverted" and its Undo button disappears.
  const handleUndo = useCallback(async (jobId: string) => {
    if (typeof ds?.undoImportJob !== 'function') return;
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && !window.confirm(t('grid.import.undoConfirm'))) return;
    setUndoingId(jobId); setError(null);
    try {
      await ds.undoImportJob(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUndoingId(null);
      void load();
    }
  }, [ds, load, t]);

  if (!supported) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground" data-testid="import-history-unsupported">
        {t('grid.import.historyUnsupported')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="import-history">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t('grid.import.historyHint')}</p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} data-testid="import-history-refresh">
          {loading ? t('grid.import.historyLoading') : t('grid.import.historyRefresh')}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive" data-testid="import-history-error">{error}</p>}
      {jobs && jobs.length === 0 && !loading && (
        <p className="p-6 text-center text-sm text-muted-foreground" data-testid="import-history-empty">
          {t('grid.import.historyEmpty')}
        </p>
      )}
      {jobs && jobs.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('grid.import.historyColStatus')}</TableHead>
              <TableHead className="text-right">{t('grid.import.historyColRows')}</TableHead>
              <TableHead className="text-right">{t('grid.import.historyColResult')}</TableHead>
              <TableHead>{t('grid.import.historyColTime')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.jobId} data-testid={`import-history-row-${job.jobId}`}>
                <TableCell>
                  <Badge variant={IMPORT_JOB_STATUS_VARIANT[job.status]}>
                    {t(`grid.import.jobStatus.${job.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{job.processed}/{job.total}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  <span className="text-emerald-600">{t('grid.import.createdCount', { count: job.created })}</span>
                  {job.updated > 0 && <span className="text-muted-foreground"> · {t('grid.import.updatedCount', { count: job.updated })}</span>}
                  {job.skipped > 0 && <span className="text-muted-foreground"> · {t('grid.import.skippedCount', { count: job.skipped })}</span>}
                  {job.errors > 0 && <span className="text-destructive"> · {t('grid.import.errorCount', { count: job.errors })}</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatImportJobTime(job.completedAt ?? job.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {isImportJobActive(job.status) && typeof ds?.cancelImportJob === 'function' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleCancel(job.jobId)}
                      data-testid={`import-history-cancel-${job.jobId}`}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> {t('grid.import.cancelImport')}
                    </Button>
                  )}
                  {job.revertedAt && (
                    <span className="text-xs text-muted-foreground" data-testid={`import-history-reverted-${job.jobId}`}>
                      {t('grid.import.reverted')}
                    </span>
                  )}
                  {isImportJobUndoable(job, canUndo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleUndo(job.jobId)}
                      disabled={undoingId === job.jobId}
                      data-testid={`import-history-undo-${job.jobId}`}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" />
                      {undoingId === job.jobId ? t('grid.import.undoing') : t('grid.import.undoImport')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

// Main wizard component
export const ImportWizard: React.FC<ImportWizardProps> = ({
  objectName, objectLabel, fields, dataSource, onComplete, onCancel, open, onOpenChange, onErrorMode = 'skip',
  templateStorageKey, templateStorage, savedMappings, initialFile, extraOptionsContent, renderResultExtra,
}) => {
  const { t } = useImportTranslation();
  const [step, setStep] = useState<WizardStep>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [corrections, setCorrections] = useState<Record<number, Record<number, string>>>({});
  // Import-job history view (swaps the wizard body for a list of prior jobs).
  const [showHistory, setShowHistory] = useState(false);
  // Async (large-file) import job — jobId + live processed/total, plus a ref the
  // poll loop reads so a mid-flight Cancel stops polling without a re-render race.
  const [jobId, setJobId] = useState<string | null>(null);
  const [asyncCounts, setAsyncCounts] = useState<{ processed: number; total: number } | null>(null);
  const cancelPollRef = React.useRef(false);
  // Small-file server dry-run pre-check — validates the exact payload without
  // writing, so the summary/error list reflect real coercion outcomes.
  const [validating, setValidating] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ImportRecordsResult | null>(null);
  // Write-mode + coercion options (drive the server-side /import request).
  const [writeMode, setWriteMode] = useState<ImportWriteMode>('insert');
  const [matchFields, setMatchFields] = useState<string[]>([]);
  const [createMissingOptions, setCreateMissingOptions] = useState(false);
  const [runAutomations, setRunAutomations] = useState(false);
  const [skipBlankMatchKey, setSkipBlankMatchKey] = useState(false);
  // Opt-in: route this import through a background job even when the row count
  // is under the async threshold. This is the only way to obtain an undoable
  // job for a small import — the sync path never captures undo state.
  const [backgroundImport, setBackgroundImport] = useState(false);
  const label = objectLabel ?? objectName;

  // Field api-name → human label, for friendlier dry-run error messages.
  const fieldLabelByName = useMemo(
    () => new Map(fields.map((f) => [f.name, f.label])),
    [fields],
  );
  // Field api-name → its source CSV column (first mapped match wins), so a
  // dry-run error can name the offending cell value without parsing the message.
  const csvIdxByField = useMemo(() => {
    const m = new Map<string, number>();
    for (const [idx, fieldName] of Object.entries(mapping)) {
      if (!m.has(fieldName)) m.set(fieldName, Number(idx));
    }
    return m;
  }, [mapping]);
  const dryRunCellValue = useCallback((row1Based: number, field?: string): string | undefined => {
    if (!field) return undefined;
    const csvIdx = csvIdxByField.get(field);
    if (csvIdx === undefined) return undefined;
    const rIdx = row1Based - 1;
    return corrections[rIdx]?.[csvIdx] ?? rows[rIdx]?.[csvIdx];
  }, [csvIdxByField, corrections, rows]);

  // The background-import toggle only makes sense when the data source can
  // actually run jobs (create + poll + fetch results). Mirrors the guard in
  // runAsyncImport so the checkbox never promises an unsupported path.
  const supportsImportJob = useMemo(() => {
    const ds = dataSource as Partial<DataSource> | undefined;
    return typeof ds?.createImportJob === 'function'
      && typeof ds?.getImportJobProgress === 'function'
      && typeof ds?.getImportJobResults === 'function';
  }, [dataSource]);

  const toggleMatchField = useCallback((name: string) => {
    setMatchFields((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }, []);

  // Keep matchFields consistent with the current column mapping — drop any
  // match key whose column was unmapped so we never send a stale key.
  useEffect(() => {
    const mapped = new Set(Object.values(mapping));
    setMatchFields((prev) => {
      const next = prev.filter((n) => mapped.has(n));
      return next.length === prev.length ? prev : next;
    });
  }, [mapping]);

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

  // ── Server-registered import mappings (framework #2611) ─────────────
  // The reusable, governed alternative to hand-building the column mapping.
  // Supplied via prop, or fetched from the adapter (feature-detected; a data
  // source without the method simply yields none, hiding the selector).
  const [fetchedMappings, setFetchedMappings] = useState<SavedMapping[]>([]);
  const [mappingName, setMappingName] = useState<string | null>(null);
  useEffect(() => {
    if (savedMappings) return; // caller-provided; don't fetch
    let alive = true;
    const list = (dataSource as { listImportMappings?: (o: string) => Promise<unknown[]> } | undefined)?.listImportMappings;
    if (typeof list !== 'function') { setFetchedMappings([]); return; }
    Promise.resolve(list.call(dataSource, objectName))
      .then((items) => { if (alive) setFetchedMappings((items ?? []).map(asSavedMapping).filter((m): m is SavedMapping => m !== null)); })
      .catch(() => { if (alive) setFetchedMappings([]); });
    return () => { alive = false; };
  }, [dataSource, objectName, savedMappings]);
  const availableMappings = savedMappings ?? fetchedMappings;
  const activeMapping = useMemo(
    () => availableMappings.find((m) => m.name === mappingName) ?? null,
    [availableMappings, mappingName],
  );

  // Select a registered mapping: the server owns rename + transforms, so we
  // set a read-only display mapping (for the preview grid) and reflect the
  // artifact's write semantics; submit sends source rows + mappingName.
  const handleSelectSavedMapping = useCallback((name: string) => {
    const m = availableMappings.find((sm) => sm.name === name);
    if (!m) return;
    setMappingName(name);
    setSelectedTemplateId(null);
    setMapping(savedMappingToDisplayIndexMap(m, headers));
    if (m.mode === 'update' || m.mode === 'upsert') setWriteMode(m.mode);
    if (Array.isArray(m.upsertKey)) setMatchFields(m.upsertKey.filter((f) => typeof f === 'string'));
    setDryRunResult(null);
  }, [availableMappings, headers]);

  // Return to hand-mapping: clear the named mapping and re-run auto-mapping.
  const handleClearSavedMapping = useCallback(() => {
    setMappingName(null);
    setWriteMode('insert');
    setMatchFields([]);
    setMapping(autoMapColumns(headers, fields, rows));
    setDryRunResult(null);
  }, [headers, fields, rows]);

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

  // cloud#797 Excel→App: when opened with a pre-loaded file (from the AI build
  // panel's attachment), parse it once and jump straight to mapping — no
  // re-picking the file the user already attached. Consumed once per File
  // identity so reopening or a re-render doesn't re-parse or fight the user if
  // they navigate back to upload.
  const consumedInitialFileRef = React.useRef<File | null>(null);
  useEffect(() => {
    if (!open || !initialFile) return;
    if (consumedInitialFileRef.current === initialFile) return;
    consumedInitialFileRef.current = initialFile;
    let cancelled = false;
    void (async () => {
      try {
        const parsed = await parseSpreadsheetFile(initialFile);
        if (cancelled) return;
        if (parsed.length < 2) return; // needs a header + at least one row
        handleFileLoaded(parsed[0], parsed.slice(1));
      } catch {
        // Parse failed — leave the wizard on the upload step so the user can
        // retry / pick a different file; the upload UI shows its own errors.
      }
    })();
    return () => { cancelled = true; };
  }, [open, initialFile, handleFileLoaded]);

  // Per-column type guesses, sampled from the loaded rows — drives mapping hints.
  const inferredTypes = useMemo<InferredType[]>(
    () => headers.map((_, idx) => inferColumnType(rows.map((r) => r[idx]))),
    [headers, rows],
  );

  // Airtable-style auto-mapping suggestions (with confidence), computed once per
  // file. Drives the "auto-matched" badges: a badge shows only while the user's
  // current mapping for a column still equals what we suggested.
  const suggestions = useMemo<ColumnSuggestion[]>(
    () => suggestColumnMappings(headers, fields, rows),
    [headers, fields, rows],
  );

  // Build raw, mapping-applied rows keyed by target field name (inline
  // corrections applied). Values stay RAW strings — the server coerces them to
  // storage values from field metadata, so booleans / dates / lookups / selects
  // are all handled uniformly server-side rather than guessed on the client.
  const buildRawRows = useCallback((): Array<Record<string, string>> => {
    const mappedCols = Object.entries(mapping).map(([idx, name]) => ({ csvIdx: Number(idx), field: name }));
    return rows.map((original, i) => {
      const fixes = corrections[i];
      const out: Record<string, string> = {};
      for (const col of mappedCols) {
        const v = fixes && fixes[col.csvIdx] !== undefined ? fixes[col.csvIdx] : (original[col.csvIdx] ?? '');
        out[col.field] = v;
      }
      return out;
    });
  }, [rows, mapping, corrections]);

  // Legacy fallback — per-row `create` with light client-side validation. Used
  // only when the adapter/client can't reach the server `/import` route.
  const legacyImport = useCallback(async () => {
    // Relation columns need the server to resolve display text into record
    // IDs; per-row `create` would store the raw text verbatim. Refuse up
    // front — corrupting relation data is worse than not importing.
    const refFields = mappedReferenceFields(mapping, fields);
    if (refFields.length > 0) {
      const importResult: ImportResult = {
        totalRows: rows.length,
        importedRows: 0,
        skippedRows: rows.length,
        errors: [{
          row: 0,
          field: refFields.map((f) => f.name).join(', '),
          message: t('grid.import.legacyReferenceBlocked', {
            fields: refFields.map((f) => f.label || f.name).join(', '),
          }),
        }],
      };
      setResult(importResult); setImporting(false); onComplete?.(importResult);
      return;
    }

    const errors: ImportResult['errors'] = [];
    let importedRows = 0, skippedRows = 0;
    const mappedCols = Object.entries(mapping).map(([idx, name]) => ({
      csvIdx: Number(idx), field: fields.find((f) => f.name === name)!,
    }));

    for (let i = 0; i < rows.length; i++) {
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
  }, [rows, mapping, fields, dataSource, objectName, onComplete, onErrorMode, corrections, t]);

  // Large-file path: hand the rows to a server-side background job and poll it
  // to completion. Returns `true` when the async path handled the import
  // (success / failure / cancel) and `false` when the data source can't run
  // jobs, signalling the caller to fall back to the synchronous route.
  const runAsyncImport = useCallback(async (request: ImportRequestOptions): Promise<boolean> => {
    const ds = dataSource as Partial<DataSource> | undefined;
    if (
      typeof ds?.createImportJob !== 'function' ||
      typeof ds?.getImportJobProgress !== 'function' ||
      typeof ds?.getImportJobResults !== 'function'
    ) {
      return false;
    }

    cancelPollRef.current = false;
    let created: CreateImportJobResult;
    try {
      created = await ds.createImportJob(objectName, request);
    } catch (err) {
      if (isUnsupportedImportJob(err)) return false;
      throw err;
    }
    setJobId(created.jobId);
    setAsyncCounts({ processed: 0, total: created.total });

    const terminal = new Set(['succeeded', 'failed', 'cancelled']);
    let consecutivePollErrors = 0;
    // Poll until the job reaches a terminal state (or the user cancels, in
    // which case the cancel handler owns producing the result).
    for (;;) {
      if (cancelPollRef.current) return true;
      await new Promise((resolve) => setTimeout(resolve, IMPORT_JOB_POLL_INTERVAL));
      if (cancelPollRef.current) return true;

      let prog: ImportJobProgressInfo;
      try {
        prog = await ds.getImportJobProgress(created.jobId);
        consecutivePollErrors = 0;
      } catch (err) {
        // Tolerate transient poll blips; give up only after several in a row so
        // a network hiccup doesn't abort an import that's still running server-side.
        if (++consecutivePollErrors >= 5) throw err;
        continue;
      }

      setAsyncCounts({ processed: prog.processed, total: prog.total });
      setProgress(prog.percentComplete);

      if (!terminal.has(prog.status)) continue;

      if (prog.status === 'cancelled') {
        const importResult: ImportResult = {
          totalRows: prog.total,
          importedRows: prog.created + prog.updated,
          skippedRows: prog.skipped + prog.errors,
          createdRows: prog.created,
          updatedRows: prog.updated,
          errors: [],
          cancelled: true,
        };
        setResult(importResult); setImporting(false); onComplete?.(importResult);
        return true;
      }

      const results = await ds.getImportJobResults(created.jobId);
      const importResult = jobResultToImportResult(results);
      if (prog.status === 'failed' && importResult.errors.length === 0) {
        importResult.errors.push({ row: 0, field: '', message: prog.error ?? 'Import failed' });
      }
      setProgress(100);
      setResult(importResult); setImporting(false); onComplete?.(importResult);
      return true;
    }
  }, [dataSource, objectName, onComplete]);

  // Assemble the server import request from the current mapping + options.
  // `dryRun` reuses the exact same payload the real import will send, so the
  // pre-check validates precisely what would be written.
  const buildImportRequest = useCallback((dryRun = false): ImportRequestOptions =>
    assembleImportRequest(
      // A named mapping is applied server-side over SOURCE-header rows; the
      // hand-mapped, field-keyed rows are for the manual path only.
      mappingName ? buildSourceRows(headers, rows, corrections) : buildRawRows(),
      {
        writeMode, matchFields, createMissingOptions, runAutomations, skipBlankMatchKey, dryRun,
        ...(mappingName ? { mappingName } : {}),
      },
    ),
  [buildRawRows, mappingName, headers, rows, corrections, writeMode, matchFields, createMissingOptions, runAutomations, skipBlankMatchKey]);

  const handleImport = useCallback(async () => {
    setImporting(true); setProgress(0);
    cancelPollRef.current = false;
    setJobId(null); setAsyncCounts(null);

    const request = buildImportRequest();

    // Route large files through a background job so they neither block the UI
    // nor trip the sync route's row ceiling. Small files can also opt into the
    // background path (the "background import" toggle) — that's the only way to
    // get an undoable job for a sub-threshold import. Any unsupported signal
    // (older adapter / client / server) falls through to the synchronous path.
    if (rows.length > ASYNC_IMPORT_THRESHOLD || backgroundImport) {
      try {
        const handled = await runAsyncImport(request);
        if (handled) return;
      } catch (err) {
        if (!isUnsupportedImportJob(err)) {
          const msg = err instanceof Error ? err.message : 'Import failed';
          const importResult: ImportResult = {
            totalRows: rows.length, importedRows: 0, skippedRows: rows.length,
            errors: [{ row: 0, field: '', message: msg }],
          };
          setResult(importResult); setImporting(false); onComplete?.(importResult);
          return;
        }
        // Unsupported — fall through to the synchronous path below.
      }
    }

    // Prefer the single-call server import: it coerces special values and
    // routes each row to insert / update / upsert. Fall back to the per-row
    // create loop only when the adapter can't speak `/import`.
    const serverImport = (dataSource as {
      importRecords?: (o: string, r: ImportRequestOptions) => Promise<ImportRecordsResult>;
    } | undefined)?.importRecords;

    if (typeof serverImport === 'function') {
      try {
        const res = await serverImport.call(dataSource, objectName, request);
        const importResult: ImportResult = {
          totalRows: res.total,
          importedRows: res.ok,
          skippedRows: res.skipped + res.errors,
          createdRows: res.created,
          updatedRows: res.updated,
          errors: res.results
            .filter((r) => !r.ok)
            .map((r) => ({ row: r.row, field: r.field ?? '', message: r.error ?? r.code ?? 'Import failed' })),
          serverResult: res,
        };
        setProgress(100);
        setResult(importResult); setImporting(false); onComplete?.(importResult);
        return;
      } catch (err) {
        if (!isUnsupportedImport(err)) {
          // A real server failure — surface it rather than silently retrying
          // via the legacy loop (which could double-import partial successes).
          const msg = err instanceof Error ? err.message : 'Import failed';
          const importResult: ImportResult = {
            totalRows: rows.length, importedRows: 0, skippedRows: rows.length,
            errors: [{ row: 0, field: '', message: msg }],
          };
          setResult(importResult); setImporting(false); onComplete?.(importResult);
          return;
        }
        // Unsupported — fall through to the legacy path below.
      }
    }

    await legacyImport();
  }, [
    dataSource, objectName, buildImportRequest, onComplete, rows.length, legacyImport, runAsyncImport,
    backgroundImport,
  ]);

  // Small-file server dry-run pre-check: validate + coerce every row without
  // persisting, so mapping / type / required errors are caught before import.
  // Large files skip this (they're validated row-by-row during the async job).
  const handleValidate = useCallback(async () => {
    const serverImport = (dataSource as {
      importRecords?: (o: string, r: ImportRequestOptions) => Promise<ImportRecordsResult>;
    } | undefined)?.importRecords;
    if (typeof serverImport !== 'function') return;
    setValidating(true);
    try {
      const res = await serverImport.call(dataSource, objectName, buildImportRequest(true));
      setDryRunResult(res);
    } catch (err) {
      // Older adapter/client without /import — silently fall back to the
      // client-side cell validation that StepPreview already shows.
      if (!isUnsupportedImport(err)) {
        const msg = err instanceof Error ? err.message : 'Validation failed';
        setDryRunResult({
          object: objectName, dryRun: true, writeMode, total: rows.length,
          ok: 0, errors: rows.length, created: 0, updated: 0, skipped: 0,
          results: [{ row: 0, ok: false, error: msg }],
        });
      }
    } finally {
      setValidating(false);
    }
  }, [dataSource, objectName, buildImportRequest, writeMode, rows.length]);

  // A prior dry-run becomes stale the moment the payload changes (mapping,
  // write-mode, options, or an inline cell correction) — drop it so the summary
  // never reflects data the user has since edited.
  useEffect(() => {
    setDryRunResult(null);
  }, [mapping, corrections, writeMode, matchFields, createMissingOptions, runAutomations, skipBlankMatchKey]);

  // User-initiated cancel of an in-flight async job. Stops the poll loop, asks
  // the server to cancel (best-effort), and shows a cancelled result.
  const handleCancelImport = useCallback(async () => {
    cancelPollRef.current = true;
    const id = jobId;
    const ds = dataSource as Partial<DataSource> | undefined;
    if (id && typeof ds?.cancelImportJob === 'function') {
      try { await ds.cancelImportJob(id); } catch { /* best-effort — the poll loop already stopped */ }
    }
    const importResult: ImportResult = {
      totalRows: asyncCounts?.total ?? rows.length,
      importedRows: 0,
      skippedRows: 0,
      errors: [],
      cancelled: true,
    };
    setResult(importResult); setImporting(false);
  }, [jobId, dataSource, asyncCounts, rows.length]);

  const reset = useCallback(() => {
    cancelPollRef.current = false;
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setProgress(0); setResult(null);
    setCorrections({}); setSelectedTemplateId(null); setMappingName(null);
    setWriteMode('insert'); setMatchFields([]);
    setCreateMissingOptions(false); setRunAutomations(false); setSkipBlankMatchKey(false);
    setJobId(null); setAsyncCounts(null);
    setValidating(false); setDryRunResult(null);
    setShowHistory(false);
  }, []);

  /** Download a CSV of just the failed rows (original values + `_error`). */
  const handleDownloadFailed = useCallback(() => {
    if (!result || result.errors.length === 0) return;
    const errorsByRow = new Map<number, string>();
    for (const e of result.errors) {
      if (e.row < 1) continue; // top-level (row 0) errors have no source row
      const prefix = e.field ? `${e.field}: ` : '';
      const existing = errorsByRow.get(e.row);
      errorsByRow.set(e.row, existing ? `${existing}; ${prefix}${e.message}` : `${prefix}${e.message}`);
    }
    if (errorsByRow.size === 0) return;
    const csv = buildFailedRowsCsv(headers, rows, mapping, errorsByRow);
    try {
      const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${objectName}-import-errors.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch { /* non-browser env */ }
  }, [result, headers, rows, mapping, objectName]);

  const handleClose = useCallback(() => { reset(); onOpenChange?.(false); onCancel?.(); }, [reset, onOpenChange, onCancel]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange?.(v); }}>
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-4xl"
        // The wizard holds unsaved upload + mapping progress, so a stray click
        // must not close it. This blocks two accidental dismissals: (1) clicking
        // the gray overlay, and (2) clicking a Radix Select's dropdown flyout,
        // which is portalled to document.body and would otherwise read as an
        // "interact outside" the dialog. Users still close via the X, Cancel, or Esc.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> {t('grid.import.title', { object: label })}
            </DialogTitle>
            {step === 'upload' && !result && !importing
              && typeof (dataSource as Partial<DataSource> | undefined)?.listImportJobs === 'function' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory((v) => !v)}
                data-testid="import-history-toggle"
              >
                {showHistory ? t('grid.import.historyBack') : t('grid.import.history')}
              </Button>
            )}
          </div>
          <DialogDescription>
            {showHistory
              ? t('grid.import.historyDescription')
              : step === 'upload' ? t('grid.import.uploadDescription')
              : step === 'mapping' ? t('grid.import.mappingDescription')
              : t('grid.import.previewDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        {!showHistory && (
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
        )}

        <div className="min-h-0 flex-1 overflow-auto">
        {showHistory ? (
          <ImportHistoryPanel objectName={objectName} dataSource={dataSource} t={t} />
        ) : !result ? (
          <>
            {step === 'upload' && <StepUpload onFileLoaded={handleFileLoaded} fields={fields} objectName={objectName} objectLabel={label} />}
            {step === 'mapping' && (
              <StepMapping
                headers={headers}
                fields={fields}
                mapping={mapping}
                onMappingChange={setMapping}
                inferredTypes={inferredTypes}
                suggestions={suggestions}
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={handleSelectTemplate}
                onSaveTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                savedMappings={availableMappings}
                activeMapping={activeMapping}
                onSelectSavedMapping={handleSelectSavedMapping}
                onClearSavedMapping={handleClearSavedMapping}
              />
            )}
            {step === 'preview' && (
              <>
                {extraOptionsContent && (
                  <div data-testid="import-extra-options">{extraOptionsContent}</div>
                )}
                {/* Write-mode/match options are owned by the artifact when a
                    named mapping is active; hide the manual panel. */}
                {!activeMapping && (
                <ImportOptions
                  fields={fields}
                  mapping={mapping}
                  writeMode={writeMode}
                  onWriteMode={setWriteMode}
                  matchFields={matchFields}
                  onToggleMatchField={toggleMatchField}
                  createMissingOptions={createMissingOptions}
                  onCreateMissingOptions={setCreateMissingOptions}
                  runAutomations={runAutomations}
                  onRunAutomations={setRunAutomations}
                  skipBlankMatchKey={skipBlankMatchKey}
                  onSkipBlankMatchKey={setSkipBlankMatchKey}
                  showBackground={supportsImportJob && rows.length <= ASYNC_IMPORT_THRESHOLD}
                  backgroundImport={backgroundImport}
                  onBackgroundImport={setBackgroundImport}
                />
                )}
                {activeMapping && (
                  <div
                    className="mb-2 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
                    data-testid="import-saved-mapping-preview-note"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t('grid.import.savedMappingPreviewNote', { name: activeMapping.label || activeMapping.name })}</span>
                  </div>
                )}
                <StepPreview
                  headers={headers}
                  rows={rows}
                  mapping={mapping}
                  fields={fields}
                  corrections={corrections}
                  onCorrect={handleCorrect}
                />
                {rows.length > ASYNC_IMPORT_THRESHOLD && (
                  <div
                    className="mt-2 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
                    data-testid="import-large-sample-notice"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t('grid.import.largeSampleNotice', { shown: PREVIEW_ROW_COUNT, total: rows.length })} {t('grid.import.asyncLargeHint')}</span>
                  </div>
                )}
                {rows.length <= ASYNC_IMPORT_THRESHOLD
                  && typeof (dataSource as Partial<DataSource> | undefined)?.importRecords === 'function' && (
                  <div className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid="import-validate">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{t('grid.import.validateHint')}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleValidate}
                        disabled={validating}
                        data-testid="import-validate-btn"
                      >
                        {validating ? t('grid.import.validating') : t('grid.import.validate')}
                      </Button>
                    </div>
                    {dryRunResult && (
                      <div className="flex flex-col gap-1" data-testid="import-validate-result">
                        <p className={`text-xs font-medium ${dryRunResult.errors > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                          {dryRunResult.errors > 0
                            ? t('grid.import.validateFailed', { ok: dryRunResult.ok, errors: dryRunResult.errors })
                            : t('grid.import.validatePassed', { ok: dryRunResult.ok })}
                        </p>
                        {dryRunResult.errors > 0 && (
                          <ul className="max-h-32 overflow-auto text-xs text-destructive">
                            {dryRunResult.results.filter((r) => !r.ok).slice(0, 20).map((r, i) => {
                              const { fieldLabel, message } = formatDryRunError(r, fieldLabelByName, dryRunCellValue(r.row, r.field), t);
                              return (
                                <li key={i}>
                                  {r.row > 0 ? t('grid.import.errorRowPrefix', { row: r.row }) : ''}
                                  {fieldLabel ? `${fieldLabel}: ` : ''}{message}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {importing && (
              <div className="flex flex-col items-center gap-2">
                <Progress value={progress} className="h-2 w-full" />
                <p className="text-center text-xs text-muted-foreground">
                  {jobId
                    ? asyncCounts
                      ? t('grid.import.asyncProcessing', { processed: asyncCounts.processed, total: asyncCounts.total, progress })
                      : t('grid.import.asyncQueued')
                    : t('grid.import.importing', { progress })}
                </p>
                {jobId && typeof (dataSource as Partial<DataSource> | undefined)?.cancelImportJob === 'function' && (
                  <Button variant="outline" size="sm" onClick={handleCancelImport} data-testid="import-cancel-async">
                    <X className="mr-1 h-4 w-4" /> {t('grid.import.cancelImport')}
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            {result.cancelled ? (
              <>
                <X className="h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-semibold">{t('grid.import.importCancelled')}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-lg font-semibold">{t('grid.import.importComplete')}</p>
              </>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {/* Prefer the finer created/updated breakdown when the server
                  reports it; otherwise fall back to a single "imported" count. */}
              {result.createdRows !== undefined || result.updatedRows !== undefined ? (
                <>
                  {(result.createdRows ?? 0) > 0 && <Badge variant="default">{t('grid.import.createdCount', { count: result.createdRows })}</Badge>}
                  {(result.updatedRows ?? 0) > 0 && <Badge variant="default">{t('grid.import.updatedCount', { count: result.updatedRows })}</Badge>}
                  {(result.createdRows ?? 0) === 0 && (result.updatedRows ?? 0) === 0 && (
                    <Badge variant="default">{t('grid.import.imported', { count: result.importedRows })}</Badge>
                  )}
                </>
              ) : (
                <Badge variant="default">{t('grid.import.imported', { count: result.importedRows })}</Badge>
              )}
              {result.skippedRows > 0 && <Badge variant="destructive">{t('grid.import.skippedCount', { count: result.skippedRows })}</Badge>}
            </div>
            {renderResultExtra && (
              <div className="w-full" data-testid="import-result-extra">{renderResultExtra(result)}</div>
            )}
            {result.errors.length > 0 && (
              <>
                <div className="max-h-32 w-full overflow-auto rounded border p-2 text-xs">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-destructive">{err.row >= 1 ? `Row ${err.row}${err.field ? ` (${err.field})` : ''}: ` : ''}{err.message}</p>
                  ))}
                  {result.errors.length > 10 && <p className="text-muted-foreground">{t('grid.import.moreErrors', { count: result.errors.length - 10 })}</p>}
                </div>
                {result.errors.some((e) => e.row >= 1) && (
                  <Button variant="outline" size="sm" onClick={handleDownloadFailed} data-testid="import-download-failed">
                    <Download className="mr-1 h-4 w-4" /> {t('grid.import.downloadFailed')}
                  </Button>
                )}
              </>
            )}
            {result.resultsTruncated && (
              <p className="text-center text-xs text-muted-foreground">
                {t('grid.import.resultsTruncated', { count: result.errors.length, total: result.skippedRows })}
              </p>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {showHistory ? (
            <Button variant="outline" onClick={() => setShowHistory(false)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> {t('grid.import.historyBack')}
            </Button>
          ) : result ? (
            <Button onClick={handleClose} data-testid="import-close-btn">{t('grid.import.close')}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={importing}><X className="mr-1 h-4 w-4" /> {t('grid.import.cancel')}</Button>
              {(step === 'mapping' || step === 'preview') && (
                <Button variant="outline" onClick={() => setStep(step === 'mapping' ? 'upload' : 'mapping')} disabled={importing}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> {t('grid.import.back')}
                </Button>
              )}
              {step === 'mapping' && (
                <Button
                  onClick={() => setStep('preview')}
                  disabled={mappingName ? false : (Object.keys(mapping).length === 0 || missingRequired.length > 0)}
                  data-testid="import-next-btn"
                >
                  {t('grid.import.next')} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              {step === 'preview' && (
                <Button
                  onClick={handleImport}
                  disabled={importing || (!mappingName && writeMode !== 'insert' && matchFields.length === 0)}
                  data-testid="import-run-btn"
                >
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
