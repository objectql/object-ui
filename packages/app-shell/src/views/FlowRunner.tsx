/**
 * FlowRunner — renders the interactive `screen` of a paused screen-flow run
 * (framework screen-flow runtime, ADR-0019) and resumes it with the collected
 * input.
 *
 * A `type: 'flow'` action launches a flow; when the run pauses at a `screen`
 * node the launch response carries `{ status: 'paused', runId, screen }`. The
 * host view (ObjectView / RecordDetailView) opens this modal with that state.
 * On submit it POSTs `/api/v1/automation/{flow}/runs/{runId}/resume` with the
 * field values as `inputs`; a `paused` response renders the next screen
 * (multi-screen wizards), a terminal response closes and refreshes the view.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Textarea,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@object-ui/components';
import { ObjectForm } from '@object-ui/plugin-form';
import { toast } from 'sonner';

export interface ScreenFieldSpec {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: Array<{ value: unknown; label: string }>;
  defaultValue?: unknown;
  placeholder?: string;
}
export interface ScreenSpec {
  nodeId: string;
  title?: string;
  description?: string;
  fields: ScreenFieldSpec[];
  /**
   * `'object-form'` renders the named object's FULL create/edit form — incl.
   * inline master-detail child grids — as a wizard step (vs. the flat `fields`
   * list). The form persists the record (and its children, atomically) itself,
   * then resumes the run with the saved id bound to `idVariable`.
   */
  kind?: 'fields' | 'object-form';
  objectName?: string;
  mode?: 'create' | 'edit';
  recordId?: string;
  defaults?: Record<string, unknown>;
  idVariable?: string;
}
export interface ScreenFlowState {
  flowName: string;
  runId: string;
  screen: ScreenSpec;
}

export interface FlowRunnerProps {
  /** The paused screen-flow to drive, or `null` when closed. */
  state: ScreenFlowState | null;
  /** Authenticated fetch (shared with the host view). */
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** API base (e.g. `import.meta.env.VITE_SERVER_URL || ''`). */
  baseUrl: string;
  /** User dismissed the runner without completing. */
  onClose: () => void;
  /** The flow ran to completion — host should refresh. */
  onComplete: () => void;
  /**
   * Data source — required to render `object-form` wizard steps. ObjectForm
   * fetches the object schema and persists (incl. atomic master-detail batch)
   * through this adapter.
   */
  dataSource?: any;
  /**
   * Object definitions — used to derive an `object-form` step's inline
   * master-detail `subforms` (mirrors RecordFormPage's create form).
   */
  objects?: any[];
}

function initialValues(screen: ScreenSpec): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of screen.fields) if (f.defaultValue !== undefined) v[f.name] = f.defaultValue;
  return v;
}

export function FlowRunner({ state, authFetch, baseUrl, onClose, onComplete, dataSource, objects }: FlowRunnerProps) {
  const [screen, setScreen] = useState<ScreenSpec | null>(null);
  const [runId, setRunId] = useState('');
  const [flowName, setFlowName] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (state) {
      setScreen(state.screen);
      setRunId(state.runId);
      setFlowName(state.flowName);
      setValues(initialValues(state.screen));
    }
  }, [state]);

  if (!state || !screen) return null;

  const setVal = (name: string, v: unknown) => setValues((p) => ({ ...p, [name]: v }));

  // Resume the paused run with `inputs` (applied as bare flow variables) and
  // advance: render the next screen (multi-step wizard) or finish + refresh.
  // Shared by the flat-field submit and the object-form save callback.
  const resumeWith = async (inputs: Record<string, unknown>): Promise<void> => {
    const res = await authFetch(
      `${baseUrl}/api/v1/automation/${encodeURIComponent(flowName)}/runs/${encodeURIComponent(runId)}/resume`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs }) },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      // Transport / envelope failure — possibly transient (network, 5xx), so
      // keep the dialog open and let the user retry the same run.
      toast.error(json?.error || `Resume failed (HTTP ${res.status})`);
      return;
    }
    const data = json?.data ?? {};
    // The HTTP envelope is `{ success:true, data: AutomationResult }`; a flow
    // that errored downstream surfaces as `data.success === false`. That is
    // TERMINAL: the engine consumes the suspension before running downstream
    // nodes (resume-once), so this run can never be resumed again — a retry
    // would only hit "No suspended run". Close the runner instead of leaving
    // a dead form open.
    if (data.success === false || data.status === 'failed') {
      toast.error(data.error || 'The flow failed to complete.');
      onClose();
      return;
    }
    if (data.status === 'paused' && data.screen) {
      setScreen(data.screen);
      setRunId(data.runId || runId);
      setValues(initialValues(data.screen));
      toast.success('Saved — next step');
    } else {
      toast.success('Done');
      onComplete();
    }
  };

  const submit = async () => {
    const missing = screen.fields.filter(
      (f) => f.required && (values[f.name] === undefined || values[f.name] === '' || values[f.name] === null),
    );
    if (missing.length) {
      toast.error(`Please fill: ${missing.map((f) => f.label || f.name).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      await resumeWith(values);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Object-form step: ObjectForm has already persisted the record (and its
  // children, atomically). Resume the run with the new record's id bound to the
  // step's `idVariable` so later steps can reference it (e.g. the Opportunity
  // form's `account` FK = the Customer step's new id).
  const onObjectFormSaved = async (saved: any) => {
    const id = saved?.id ?? saved?.data?.id ?? saved?.record?.id;
    const inputs = screen.idVariable && id != null ? { [screen.idVariable]: id } : {};
    setSubmitting(true);
    try {
      await resumeWith(inputs);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const isObjectForm = screen.kind === 'object-form' && !!screen.objectName;
  const objectDef = isObjectForm && Array.isArray(objects)
    ? objects.find((o: any) => o?.name === screen.objectName)
    : undefined;
  const subforms = objectDef
    ? ((objectDef as any).form?.subforms ?? (objectDef as any).formViews?.default?.subforms)
    : undefined;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className={isObjectForm ? 'sm:max-w-3xl max-h-[90vh] overflow-y-auto' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{screen.title || 'Input'}</DialogTitle>
          {screen.description && <DialogDescription>{screen.description}</DialogDescription>}
        </DialogHeader>

        {isObjectForm ? (
          // Full object create/edit form (with inline master-detail grids). The
          // form owns its own Save/Cancel bar; on save it persists and calls
          // onObjectFormSaved, which resumes the run to the next step.
          <div className="py-2">
            {dataSource ? (
              <ObjectForm
                key={screen.nodeId}
                schema={{
                  type: 'object-form',
                  formType: 'simple',
                  objectName: screen.objectName!,
                  mode: screen.mode === 'edit' ? 'edit' : 'create',
                  recordId: screen.mode === 'edit' ? screen.recordId : undefined,
                  ...(screen.defaults ? { initialValues: screen.defaults } : {}),
                  layout: 'vertical',
                  subforms,
                  onSuccess: onObjectFormSaved,
                  onCancel: onClose,
                  showSubmit: true,
                  showCancel: true,
                  submitText: 'Save & Continue',
                  cancelText: 'Cancel',
                } as any}
                dataSource={dataSource}
              />
            ) : (
              <div className="text-sm text-destructive py-4">
                This step renders an object form but no data source is available.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {screen.fields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label htmlFor={`ff-${f.name}`} className="text-sm">
                    {f.label || f.name}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <FieldInput field={f} value={values[f.name]} onChange={(v) => setVal(f.name, v)} />
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: { field: ScreenFieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  const id = `ff-${field.name}`;
  const t = (field.type || 'text').toLowerCase();

  if (Array.isArray(field.options) && field.options.length > 0) {
    return (
      <Select value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id={id}><SelectValue placeholder={field.placeholder || 'Select…'} /></SelectTrigger>
        <SelectContent>
          {field.options.map((o, i) => (
            <SelectItem key={i} value={String(o.value)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (t === 'boolean' || t === 'checkbox') {
    return <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(c === true)} />;
  }
  if (t === 'textarea' || t === 'markdown') {
    return <Textarea id={id} value={(value as string) ?? ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  const htmlType = t === 'number' || t === 'currency' ? 'number' : t === 'email' ? 'email' : t === 'date' ? 'date' : 'text';
  return (
    <Input
      id={id}
      type={htmlType}
      value={(value as string) ?? ''}
      placeholder={field.placeholder}
      onChange={(e) => onChange(htmlType === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
    />
  );
}
