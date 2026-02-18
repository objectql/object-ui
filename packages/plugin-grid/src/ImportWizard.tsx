/**
 * ObjectUI – Copyright (c) 2024-present ObjectStack Inc.
 * Licensed under MIT. Phase 15 L1: CSV/Excel Import Wizard
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  cn, Button, Badge, Progress,
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@object-ui/components';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ArrowRight, ArrowLeft } from 'lucide-react';

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

/** CSV parser with quote handling */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = []; field = '';
      if (ch === '\r') i++;
    } else { field += ch; }
  }
  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function validateValue(value: string, type: string): boolean {
  if (!value) return true;
  switch (type) {
    case 'number': case 'currency': case 'percent': return !isNaN(Number(value));
    case 'boolean': return ['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase());
    case 'date': case 'datetime': return !isNaN(Date.parse(value));
    default: return true;
  }
}

function autoMapColumns(headers: string[], fields: ImportWizardProps['fields']): Record<number, string> {
  const mapping: Record<number, string> = {};
  headers.forEach((header, idx) => {
    const h = header.toLowerCase().replace(/[_\s-]/g, '');
    const match = fields.find((f) => {
      const name = f.name.toLowerCase().replace(/[_\s-]/g, '');
      const label = f.label.toLowerCase().replace(/[_\s-]/g, '');
      return name === h || label === h;
    });
    if (match) mapping[idx] = match.name;
  });
  return mapping;
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

// Step 1: File Upload
const StepUpload: React.FC<{ onFileLoaded: (headers: string[], rows: string[][]) => void }> = ({ onFileLoaded }) => {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    if (!file.name.endsWith('.csv')) { setError('Only CSV files are supported.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target?.result as string);
      if (parsed.length < 2) { setError('File must contain a header row and at least one data row.'); return; }
      onFileLoaded(parsed[0], parsed.slice(1));
    };
    reader.readAsText(file);
  }, [onFileLoaded]);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
      >
        <Upload className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Drag & drop a CSV file here, or click to browse</p>
        <label>
          <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          <Button variant="outline" size="sm" asChild><span>Browse Files</span></Button>
        </label>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
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
}> = ({ headers, fields, mapping, onMappingChange }) => {
  const usedFields = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const handleChange = useCallback((colIdx: number, fieldName: string) => {
    const next = { ...mapping };
    if (fieldName === '__skip__') delete next[colIdx]; else next[colIdx] = fieldName;
    onMappingChange(next);
  }, [mapping, onMappingChange]);

  return (
    <div className="max-h-[360px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CSV Column</TableHead>
            <TableHead>Maps To</TableHead>
            <TableHead className="w-24 text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {headers.map((header, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium">{header}</TableCell>
              <TableCell>
                <Select value={mapping[idx] ?? '__skip__'} onValueChange={(v) => handleChange(idx, v)}>
                  <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Skip column" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">— Skip —</SelectItem>
                    {fields.map((f) => (
                      <SelectItem key={f.name} value={f.name} disabled={usedFields.has(f.name) && mapping[idx] !== f.name}>
                        {f.label}{f.required ? ' *' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-center">
                {mapping[idx]
                  ? <Badge variant="default" className="text-xs">Mapped</Badge>
                  : <Badge variant="secondary" className="text-xs">Skipped</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// Step 3: Preview & Import (shows first 10 rows with per-row validation errors)
const StepPreview: React.FC<{
  headers: string[]; rows: string[][]; mapping: Record<number, string>; fields: ImportWizardProps['fields'];
}> = ({ headers, rows, mapping, fields }) => {
  const mappedCols = useMemo(() =>
    Object.entries(mapping).map(([idx, fieldName]) => ({
      csvIdx: Number(idx), header: headers[Number(idx)], field: fields.find((f) => f.name === fieldName)!,
    })), [mapping, headers, fields]);
  const previewRows = rows.slice(0, PREVIEW_ROW_COUNT);

  const rowValidations = useMemo(() => previewRows.map((row, rIdx) => {
    const errs: Record<number, string> = {};
    for (const col of mappedCols) {
      const raw = row[col.csvIdx] ?? '';
      if (col.field.required && !raw) errs[col.csvIdx] = 'Required';
      else if (raw && !validateValue(raw, col.field.type)) errs[col.csvIdx] = `Invalid ${col.field.type}`;
    }
    return errs;
  }), [previewRows, mappedCols]);

  const errorCount = rowValidations.filter(e => Object.keys(e).length > 0).length;

  return (
    <div className="max-h-[360px] overflow-auto">
      {errorCount > 0 && (
        <p className="mb-2 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {errorCount} row(s) with errors in preview
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
          {previewRows.map((row, rIdx) => {
            const errs = rowValidations[rIdx];
            const hasError = Object.keys(errs).length > 0;
            return (
              <TableRow key={rIdx} className={cn(hasError && 'bg-destructive/5')}>
                <TableCell className="text-xs text-muted-foreground">{rIdx + 1}</TableCell>
                {mappedCols.map((col) => {
                  const value = row[col.csvIdx] ?? '';
                  const cellErr = errs[col.csvIdx];
                  return (
                    <TableCell key={col.csvIdx} className={cn(cellErr && 'text-destructive')} title={cellErr}>
                      {value || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">Showing {previewRows.length} of {rows.length} rows</p>
    </div>
  );
};

// Main wizard component
export const ImportWizard: React.FC<ImportWizardProps> = ({
  objectName, objectLabel, fields, dataSource, onComplete, onCancel, open, onOpenChange, onErrorMode = 'skip',
}) => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const label = objectLabel ?? objectName;

  const missingRequired = useMemo(() => {
    const mapped = new Set(Object.values(mapping));
    return fields.filter((f) => f.required && !mapped.has(f.name));
  }, [fields, mapping]);

  const handleFileLoaded = useCallback((h: string[], r: string[][]) => {
    setHeaders(h); setRows(r); setMapping(autoMapColumns(h, fields)); setStep('mapping');
  }, [fields]);

  const handleImport = useCallback(async () => {
    setImporting(true); setProgress(0);
    const errors: ImportResult['errors'] = [];
    let importedRows = 0, skippedRows = 0;
    const mappedCols = Object.entries(mapping).map(([idx, name]) => ({
      csvIdx: Number(idx), field: fields.find((f) => f.name === name)!,
    }));

    for (let i = 0; i < rows.length; i++) {
      const { record, errors: rowErrors } = validateRow(rows[i], mappedCols, i + 1);
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
  }, [rows, mapping, fields, dataSource, objectName, onComplete, onErrorMode]);

  const reset = useCallback(() => {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setProgress(0); setResult(null);
  }, []);

  const handleClose = useCallback(() => { reset(); onOpenChange?.(false); onCancel?.(); }, [reset, onOpenChange, onCancel]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange?.(v); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import {label}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file to get started.'}
            {step === 'mapping' && 'Map CSV columns to object fields.'}
            {step === 'preview' && 'Review data before importing.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {(['upload', 'mapping', 'preview'] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <ArrowRight className="h-3 w-3" />}
              <span className={cn('rounded-full px-3 py-1', step === s ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {i + 1}. {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Mapping' : 'Preview'}
              </span>
            </React.Fragment>
          ))}
        </div>

        {!result ? (
          <>
            {step === 'upload' && <StepUpload onFileLoaded={handleFileLoaded} />}
            {step === 'mapping' && <StepMapping headers={headers} fields={fields} mapping={mapping} onMappingChange={setMapping} />}
            {step === 'preview' && <StepPreview headers={headers} rows={rows} mapping={mapping} fields={fields} />}
            {importing && (
              <div className="flex flex-col gap-1">
                <Progress value={progress} className="h-2" />
                <p className="text-center text-xs text-muted-foreground">Importing… {progress}%</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-lg font-semibold">Import Complete</p>
            <div className="flex gap-3">
              <Badge variant="default">{result.importedRows} imported</Badge>
              {result.skippedRows > 0 && <Badge variant="destructive">{result.skippedRows} skipped</Badge>}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-32 w-full overflow-auto rounded border p-2 text-xs">
                {result.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-destructive">Row {err.row}{err.field ? ` (${err.field})` : ''}: {err.message}</p>
                ))}
                {result.errors.length > 10 && <p className="text-muted-foreground">…and {result.errors.length - 10} more errors</p>}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {result ? (
            <Button onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={importing}><X className="mr-1 h-4 w-4" /> Cancel</Button>
              {(step === 'mapping' || step === 'preview') && (
                <Button variant="outline" onClick={() => setStep(step === 'mapping' ? 'upload' : 'mapping')} disabled={importing}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              {step === 'mapping' && (
                <Button onClick={() => setStep('preview')} disabled={Object.keys(mapping).length === 0 || missingRequired.length > 0}>
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              {step === 'preview' && (
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? 'Importing…' : `Import ${rows.length} Rows`}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
