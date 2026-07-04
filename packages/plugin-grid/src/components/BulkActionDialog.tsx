/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@object-ui/components';
import { AlertTriangle, Check, CheckCircle2, ChevronsUpDown, Loader2, XCircle } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/react';
import type { BulkActionDef, BulkActionParam } from '@object-ui/types';
import { useBulkExecutor, type BulkExecutorOptions, type BulkResult } from '../hooks/useBulkExecutor';

export interface BulkActionDialogProps {
  /** The action being executed. */
  def: BulkActionDef | null;
  /** Selected records to operate on. */
  rows: Array<Record<string, unknown>>;
  /** Object resource name (passed to the executor + lookup loader). */
  resource: string;
  /** Data source used by the executor + lookup-param loader. */
  dataSource: BulkExecutorOptions['dataSource'] & {
    find?: (
      resource: string,
      query?: Record<string, unknown>,
    ) => Promise<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>;
  };
  /** Open state. */
  open: boolean;
  /** Close handler — invoked on Cancel, on overlay click, or after Done. */
  onClose: (result?: BulkResult | null) => void;
  /** Optional column to use as a row label in previews (defaults to 'name'). */
  labelKey?: string;
}

type Step = 'params' | 'confirm' | 'running' | 'result';

interface LookupOption {
  value: string;
  label: string;
}

/**
 * 4-step bulk action dialog. Resolves param values, lets the user confirm the
 * impact, executes via useBulkExecutor, then displays a success/failure
 * summary with a downloadable error list when applicable.
 */
export const BulkActionDialog: React.FC<BulkActionDialogProps> = ({
  def,
  rows,
  resource,
  dataSource,
  open,
  onClose,
  labelKey = 'name',
}) => {
  const { t } = useObjectTranslation();
  const params = def?.params ?? [];
  const initialParamValues = useMemo<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const p of params) {
      if (p.default !== undefined) v[p.name] = p.default;
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.name]);

  const [step, setStep] = useState<Step>('params');
  const [values, setValues] = useState<Record<string, unknown>>(initialParamValues);
  const [lookupCache, setLookupCache] = useState<Record<string, LookupOption[]>>({});
  const { run, undo, retry, progress, result, reset } = useBulkExecutor({ resource, dataSource });
  const [retrying, setRetrying] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoneAt, setUndoneAt] = useState<number | null>(null);

  // #2185 — keep the dialog open when the user dismisses a nested Radix popper
  // (the Status <Select> dropdown or a ComboBox <Popover>) by clicking away from
  // it. Radix leaves the dialog overlay at pointer-events:auto while marking the
  // dialog body pointer-events:none, so that click lands on the backdrop and
  // Radix's DismissableLayer would tear the whole dialog down. We can't detect
  // the open popper inside the dialog's onInteractOutside handler — by the time
  // it runs, Radix has already unmounted the popper (verified: popper is present
  // at capture-phase pointerdown but gone by bubble). So we snapshot "was a
  // popper open?" on the capture-phase pointerdown and let the guards below read
  // that snapshot instead of the (already stale) live DOM.
  const popperOpenAtPointerDown = useRef(false);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = () => {
      popperOpenAtPointerDown.current = !!document.querySelector(
        '[data-radix-popper-content-wrapper] [data-state="open"]',
      );
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  // Reset internal state whenever the dialog re-opens for a different action.
  useEffect(() => {
    if (!open) return;
    reset();
    setValues(initialParamValues);
    setUndoneAt(null);
    setUndoing(false);
    setRetrying(null);
    // Skip params step when nothing to collect.
    setStep(params.length === 0 ? 'confirm' : 'params');
  }, [open, def?.name, initialParamValues, params.length, reset]);

  // Eagerly load lookup options for any lookup param. Cheap for the MVP since
  // most CRM lookups (users, queues) cap out at a few hundred rows.
  useEffect(() => {
    if (!open) return;
    if (typeof dataSource.find !== 'function') return;
    const lookups = params.filter(p => p.type === 'lookup' && p.object && !lookupCache[p.name]);
    if (lookups.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, LookupOption[]> = {};
      for (const p of lookups) {
        try {
          const res = await dataSource.find!(p.object as string, { $top: 200 });
          const items = Array.isArray(res) ? res : (res?.data ?? []);
          const labelField = typeof p.labelField === 'string' ? p.labelField : undefined;
          next[p.name] = items.map(r => ({
            value: String(r.id ?? r._id ?? ''),
            label: String(
              (labelField ? r[labelField] : undefined)
              ?? r.name ?? r.full_name ?? r.email ?? r.id ?? '(unnamed)',
            ),
          })).filter(o => o.value);
        } catch {
          next[p.name] = [];
        }
      }
      if (!cancelled) setLookupCache(prev => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, def?.name]);

  const paramsValid = useMemo(() => {
    for (const p of params) {
      if (p.required) {
        const v = values[p.name];
        if (v === undefined || v === null || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
      }
    }
    return true;
  }, [params, values]);

  // Resolve a param value into a human-readable string for the confirm step:
  // maps select/lookup ids back to their labels, joins multi-value arrays, and
  // renders booleans/empties sensibly (a raw `String(v)` would show ids and
  // `[object Object]`).
  const describeValue = useCallback((param: BulkActionParam | undefined, v: unknown): string => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return '—';
    if (typeof v === 'boolean') return v ? t('grid.yes', { defaultValue: 'Yes' }) : t('grid.no', { defaultValue: 'No' });
    const optSource: LookupOption[] = param?.type === 'lookup'
      ? (lookupCache[param.name] ?? [])
      : (param?.options ?? []).map(o => ({ value: String(o.value), label: String(o.label) }));
    const labelOf = (x: unknown) => optSource.find(o => o.value === String(x))?.label ?? String(x);
    return Array.isArray(v) ? v.map(labelOf).join(', ') : labelOf(v);
  }, [t, lookupCache]);

  const maxRecords = def?.maxRecords ?? Infinity;
  const overLimit = rows.length > maxRecords;

  const handleRun = useCallback(async () => {
    if (!def) return;
    setStep('running');
    await run(def, rows, values);
    setStep('result');
  }, [def, rows, values, run]);

  const downloadErrors = useCallback(() => {
    if (!result?.errors?.length) return;
    const header = 'record_id,error_message';
    const csv = [header, ...result.errors.map(e =>
      `${e.id},"${e.error.replace(/"/g, '""')}"`,
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_errors_${def?.name ?? 'action'}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, def?.name]);

  // Undo is only meaningful for `update` runs where at least one row landed.
  // For delete / custom we never captured a snapshot, so the executor will
  // refuse the undo — but we hide the button up-front to avoid dead UI.
  const canUndo =
    !!def
    && def.operation === 'update'
    && !!result
    && result.succeeded > 0
    && undoneAt === null;

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    try {
      const undoResult = await undo();
      if (undoResult) {
        setUndoneAt(Date.now());
      }
    } finally {
      setUndoing(false);
    }
  }, [undo]);

  const handleRetry = useCallback(
    async (rowId: string) => {
      setRetrying(rowId);
      try {
        await retry(rowId);
      } finally {
        setRetrying(null);
      }
    },
    [retry],
  );

  if (!def) return null;

  const title = def.label ?? def.name;
  const previewRows = rows.slice(0, 5);
  const restCount = Math.max(0, rows.length - previewRows.length);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(result); }}>
      <DialogContent
        className="max-w-md"
        // If the outside interaction that reached the dialog was really the user
        // dismissing an open nested popper (see popperOpenAtPointerDown above),
        // swallow it: the popper's own DismissableLayer already closed the
        // dropdown, so the first click away just dismisses it and the dialog
        // stays put. A genuine backdrop click (no popper open) still closes the
        // dialog normally. (#2185)
        onPointerDownOutside={(e) => {
          if (popperOpenAtPointerDown.current) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (popperOpenAtPointerDown.current) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
            {title}
          </DialogTitle>
          {step === 'confirm' && (
            <DialogDescription>
              {def.confirmText ?? t('grid.bulk.confirmDefault', { count: rows.length, defaultValue: `This will apply to ${rows.length} record(s).` })}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'params' && (
          <div className="space-y-3">
            {params.map(p => (
              <ParamField
                key={p.name}
                param={p}
                value={values[p.name]}
                lookupOptions={lookupCache[p.name]}
                onChange={(v) => setValues(prev => ({ ...prev, [p.name]: v }))}
              />
            ))}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3 text-sm">
            {overLimit && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {t('grid.bulk.overLimit', {
                    count: rows.length,
                    limit: maxRecords,
                    defaultValue: `Selection (${rows.length}) exceeds the action limit (${maxRecords}). Reduce the selection to proceed.`,
                  })}
                </div>
              </div>
            )}
            <div className="text-muted-foreground">
              {t('grid.bulk.affectedRecords', { count: rows.length, defaultValue: `Affected records (${rows.length}):` })}
            </div>
            <ScrollArea className="max-h-32 rounded border bg-muted/30 p-2">
              <ul className="text-xs space-y-1">
                {previewRows.map((r, i) => (
                  <li key={String(r.id ?? i)} className="break-words">
                    • {String(r[labelKey] ?? r.id ?? t('grid.bulk.rowFallback', { index: i + 1, defaultValue: `Row ${i + 1}` }))}
                  </li>
                ))}
                {restCount > 0 && (
                  <li className="text-muted-foreground">
                    {t('grid.bulk.andMore', { count: restCount, defaultValue: `… and ${restCount} more` })}
                  </li>
                )}
              </ul>
            </ScrollArea>
            {Object.keys(values).length > 0 && (
              <div className="rounded border bg-muted/30 p-2 text-xs space-y-0.5">
                {Object.entries(values).map(([k, v]) => {
                  const p = params.find(x => x.name === k);
                  return (
                    <div key={k}>
                      <span className="text-muted-foreground">{p?.label ?? k}:</span> {describeValue(p, v)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'running' && (
          <div className="space-y-2">
            <Progress value={progress.total ? (progress.done + progress.failed) / progress.total * 100 : 0} />
            <div className="text-xs text-muted-foreground text-center">
              {t('grid.bulk.processed', {
                count: progress.done + progress.failed,
                total: progress.total,
                defaultValue: `${progress.done + progress.failed} / ${progress.total} processed`,
              })}
              {progress.failed > 0 && t('grid.bulk.processedFailed', { count: progress.failed, defaultValue: ` · ${progress.failed} failed` })}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <span>
                {undoneAt !== null ? t('grid.bulk.undonePrefix', { defaultValue: 'Undone — ' }) : ''}
                {t('grid.bulk.succeeded', {
                  count: result.succeeded,
                  total: result.total,
                  defaultValue: `Succeeded ${result.succeeded} / ${result.total}`,
                })}
                {result.failed > 0 && t('grid.bulk.resultFailed', { count: result.failed, defaultValue: ` · Failed ${result.failed}` })}
              </span>
            </div>
            {result.errors.length > 0 && (
              <>
                <ScrollArea className="max-h-48 rounded border bg-destructive/5 p-2" data-testid="bulk-error-inspector">
                  <ul className="text-xs space-y-1.5">
                    {result.errors.map(e => (
                      <li
                        key={e.id}
                        className="flex items-start gap-2"
                        data-testid={`bulk-error-row-${e.id}`}
                      >
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
                        <div className="min-w-0 flex-1">
                          <div className="break-words">
                            <span className="text-muted-foreground">{e.id}:</span> {e.error}
                          </div>
                        </div>
                        {def.operation !== 'custom' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] shrink-0"
                            onClick={() => handleRetry(e.id)}
                            disabled={retrying === e.id}
                            data-testid={`bulk-error-retry-${e.id}`}
                          >
                            {retrying === e.id ? '…' : t('grid.bulk.retry', { defaultValue: 'Retry' })}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  {t('grid.bulk.downloadErrorCsv', { defaultValue: 'Download error CSV' })}
                </Button>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'params' && (
            <>
              <Button variant="ghost" onClick={() => onClose()}>{t('grid.bulk.cancel', { defaultValue: 'Cancel' })}</Button>
              <Button onClick={() => setStep('confirm')} disabled={!paramsValid}>{t('grid.bulk.next', { defaultValue: 'Next' })}</Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="ghost" onClick={() => params.length ? setStep('params') : onClose()}>
                {params.length ? t('grid.bulk.back', { defaultValue: 'Back' }) : t('grid.bulk.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                variant={def.variant === 'danger' ? 'destructive' : 'default'}
                onClick={handleRun}
                disabled={overLimit}
              >
                {def.confirmLabel ?? t('grid.bulk.run', { defaultValue: 'Run' })}
              </Button>
            </>
          )}
          {step === 'running' && (
            <Button variant="ghost" disabled>
              {t('grid.bulk.running', { defaultValue: 'Running…' })}
            </Button>
          )}
          {step === 'result' && (
            <>
              {canUndo && (
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  disabled={undoing}
                  data-testid="bulk-undo-button"
                >
                  {undoing ? t('grid.bulk.undoing', { defaultValue: 'Undoing…' }) : t('grid.bulk.undo', { defaultValue: 'Undo' })}
                </Button>
              )}
              <Button onClick={() => onClose(result)}>{t('grid.bulk.done', { defaultValue: 'Done' })}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ParamFieldProps {
  param: BulkActionParam;
  value: unknown;
  onChange: (v: unknown) => void;
  lookupOptions?: LookupOption[];
}

const ParamField: React.FC<ParamFieldProps> = ({ param, value, onChange, lookupOptions }) => {
  const { t } = useObjectTranslation();
  const id = `bulk-param-${param.name}`;
  const label = (
    <Label htmlFor={id} className="text-xs">
      {param.label ?? param.name}
      {param.required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  let control: React.ReactNode = null;
  switch (param.type) {
    case 'boolean':
      control = (
        <Switch
          id={id}
          checked={!!value}
          onCheckedChange={onChange}
        />
      );
      break;
    case 'textarea':
      control = (
        <Textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={param.placeholder}
        />
      );
      break;
    case 'select': {
      const options = (param.options ?? []).map(o => ({ value: String(o.value), label: o.label }));
      control = param.multiple ? (
        <MultiSelectControl
          id={id}
          options={options}
          value={value}
          onChange={onChange}
          placeholder={param.placeholder ?? t('grid.bulk.selectPlaceholder', { defaultValue: 'Select…' })}
        />
      ) : (
        <Select value={value !== undefined && value !== null ? String(value) : ''} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={param.placeholder ?? t('grid.bulk.selectPlaceholder', { defaultValue: 'Select…' })} />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    }
    case 'lookup': {
      const opts = lookupOptions ?? [];
      const loadingPlaceholder = opts.length === 0
        ? t('grid.bulk.loading', { defaultValue: 'Loading…' })
        : (param.placeholder ?? t('grid.bulk.selectPlaceholder', { defaultValue: 'Select…' }));
      control = param.multiple ? (
        <MultiSelectControl
          id={id}
          options={opts}
          value={value}
          onChange={onChange}
          placeholder={loadingPlaceholder}
        />
      ) : (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={loadingPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {opts.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    }
    case 'date':
      control = (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)}
          placeholder={param.placeholder}
        />
      );
      break;
    case 'datetime':
      control = (
        <Input
          id={id}
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)}
          placeholder={param.placeholder}
        />
      );
      break;
    case 'number':
      control = (
        <Input
          id={id}
          type="number"
          value={(value as number | string) ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder={param.placeholder}
        />
      );
      break;
    default:
      control = (
        <Input
          id={id}
          type="text"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={param.placeholder}
        />
      );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label}
      </div>
      {control}
      {param.help && <p className="text-[11px] text-muted-foreground">{param.help}</p>}
    </div>
  );
};

interface MultiSelectControlProps {
  id: string;
  options: LookupOption[];
  value: unknown;
  onChange: (v: string[]) => void;
  placeholder?: string;
}

/**
 * Popover + Command multi-select used for `multiple` select/lookup params. The
 * value is a string array (written straight into the patch to match a
 * multi-value backend field). Search filters the already-loaded option set.
 */
const MultiSelectControl: React.FC<MultiSelectControlProps> = ({ id, options, value, onChange, placeholder }) => {
  const { t } = useObjectTranslation();
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? (value as unknown[]).map(String) : [];
  const labelOf = (v: string) => options.find(o => o.value === v)?.label ?? v;
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-9 font-normal"
        >
          <span className="flex flex-wrap gap-1 items-center text-left">
            {selected.length === 0 && (
              <span className="text-muted-foreground">
                {placeholder ?? t('grid.bulk.selectPlaceholder', { defaultValue: 'Select…' })}
              </span>
            )}
            {selected.map(v => (
              <Badge key={v} variant="secondary" className="font-normal">{labelOf(v)}</Badge>
            ))}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('grid.bulk.searchPlaceholder', { defaultValue: 'Search…' })} />
          <CommandList>
            <CommandEmpty>{t('grid.bulk.noOptions', { defaultValue: 'No options.' })}</CommandEmpty>
            <CommandGroup>
              {options.map(o => {
                const checked = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                    <Check className={`mr-2 h-4 w-4 ${checked ? 'opacity-100' : 'opacity-0'}`} />
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
