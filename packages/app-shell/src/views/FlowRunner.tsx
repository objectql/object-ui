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
}

function initialValues(screen: ScreenSpec): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const f of screen.fields) if (f.defaultValue !== undefined) v[f.name] = f.defaultValue;
  return v;
}

export function FlowRunner({ state, authFetch, baseUrl, onClose, onComplete }: FlowRunnerProps) {
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
      const res = await authFetch(
        `${baseUrl}/api/v1/automation/${encodeURIComponent(flowName)}/runs/${encodeURIComponent(runId)}/resume`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs: values }) },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        toast.error(json?.error || `Resume failed (HTTP ${res.status})`);
        return;
      }
      const data = json?.data ?? {};
      // The HTTP envelope is `{ success:true, data: AutomationResult }`; a flow
      // that errored downstream surfaces as `data.success === false`.
      if (data.success === false || data.status === 'failed') {
        toast.error(data.error || 'The flow failed to complete.');
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
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{screen.title || 'Input'}</DialogTitle>
          {screen.description && <DialogDescription>{screen.description}</DialogDescription>}
        </DialogHeader>

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
