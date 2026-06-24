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
 *
 * The screen BODY (flat fields / object-form) is rendered by the shared
 * {@link ScreenView} — the same renderer the Studio design preview reuses, so
 * the two can never drift (cf. #1927).
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
} from '@object-ui/components';
import { toast } from 'sonner';
import { ScreenView, isObjectFormScreen, initialScreenValues, type ScreenSpec } from './ScreenView';

export type { ScreenSpec, ScreenFieldSpec } from './ScreenView';

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
      setValues(initialScreenValues(state.screen));
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
      // Prefer the flow's friendly `errorMessage`; fall back to the raw error.
      toast.error(data.errorMessage || data.error || 'The flow failed to complete.');
      onClose();
      return;
    }
    if (data.status === 'paused' && data.screen) {
      setScreen(data.screen);
      setRunId(data.runId || runId);
      setValues(initialScreenValues(data.screen));
      toast.success('Saved — next step');
    } else {
      // Terminal success — show the flow's declared completion message.
      toast.success(data.successMessage || 'Done');
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

  const isObjectForm = isObjectFormScreen(screen);

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className={isObjectForm ? 'sm:max-w-3xl max-h-[90vh] overflow-y-auto' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{screen.title || 'Input'}</DialogTitle>
          {screen.description && <DialogDescription>{screen.description}</DialogDescription>}
        </DialogHeader>

        <ScreenView
          screen={screen}
          values={values}
          onValueChange={setVal}
          dataSource={dataSource}
          objects={objects}
          objectForm={{
            onSuccess: onObjectFormSaved,
            onCancel: onClose,
            showSubmit: true,
            showCancel: true,
            submitText: 'Save & Continue',
            cancelText: 'Cancel',
          }}
        />

        {!isObjectForm && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
