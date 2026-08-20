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
import { Suspense, useEffect, useState } from 'react';
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
import { ScreenView, isObjectFormScreen, initialScreenValues, visibleScreenFields, type ScreenSpec } from './ScreenView.js';
import { interpretFlowResponse } from '../utils/flowResponse.js';

export type { ScreenSpec, ScreenFieldSpec } from './ScreenView.js';

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
    // Shared with the two flow-LAUNCH handlers (useConsoleActionRuntime,
    // RecordDetailView) so the resume path and the launch path can never again
    // disagree about what a failure looks like — they did, and the launch
    // copies reported failures as success (#2958). `outcome.error` is always a
    // STRING: handing the nested `{code, message}` object to `toast.error()`
    // renders nothing at best and crashes the page as a React child (React
    // #31). See utils/flowResponse.
    const outcome = interpretFlowResponse<ScreenSpec>(res, json, 'Resume');
    if (outcome.kind === 'failed') {
      toast.error(outcome.error);
      // A transport / envelope failure may be transient (network, 5xx) and did
      // not consume the suspension — keep the dialog open so the user can retry
      // the same run. A flow failure is TERMINAL: the engine consumes the
      // suspension before running downstream nodes (resume-once), so a retry
      // would only hit "No suspended run". Close instead of leaving a dead form.
      if (!outcome.retryable) onClose();
      return;
    }
    if (outcome.kind === 'paused') {
      setScreen(outcome.screen);
      setRunId(outcome.runId || runId);
      setValues(initialScreenValues(outcome.screen));
      toast.success('Saved — next step');
    } else {
      // Terminal success — show the flow's declared completion message.
      toast.success(outcome.successMessage || 'Done');
      onComplete();
    }
  };

  const submit = async () => {
    // Enforce `required` over the fields ACTUALLY ON SCREEN, not the whole
    // declared list. A `visibleWhen` field that is required *when shown* is not
    // required while hidden — the user was never asked for it, and the flow is
    // not waiting on it. Validating the full list here is what dead-ended
    // #3528: HotCRM's lead conversion declares `opportunityName` required with
    // `visibleWhen: createOpportunity == true`, so leaving the checkbox
    // unticked blocked Submit on an input that was not on screen, and the run
    // sat paused with no resume request ever issued.
    const missing = visibleScreenFields(screen, values).filter(
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

        {/* The screen body pulls in lazily-loaded chunks (an `object-form` step
            mounts ObjectForm, whose field widgets are lazy). Without a boundary
            HERE, that suspension unwinds to the host's nearest <Suspense> — a
            route-level one on some surfaces — which swaps the whole page for a
            fallback and destroys the host's state, taking this dialog (and the
            run it is driving) with it. */}
        <Suspense fallback={<div className="py-6 text-sm text-muted-foreground">Loading…</div>}>
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
        </Suspense>

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
