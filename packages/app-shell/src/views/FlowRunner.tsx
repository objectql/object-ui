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
 *
 * ## The resume RESULT has to reach the user (objectui#5417)
 *
 * A dogfood walkthrough reported that a `400 FLOW_FAILED` and a successful run
 * "render identically: the dialog closes and the page is unchanged". Half of
 * that was already fixed by the time it was triaged — `interpretFlowResponse`
 * reads the ADR-0112 envelope and the `toast.error` below has carried its prose
 * since #4899 — but three gaps survived, and they are what this component now
 * answers:
 *
 * 1. **A terminal failure closed the dialog, taking the user's input with it.**
 *    The reason it closed is still sound and is NOT reversed here: on a
 *    `FLOW_FAILED` the engine has already consumed the suspension
 *    (resume-once), so a retry can only reach "No suspended run", and offering
 *    one is a lie. What #4899 concluded from that — *close* — is one way to
 *    withhold the dead retry, and it is the expensive one: the user has just
 *    typed a form they can no longer see, and the sentence explaining the
 *    refusal names a value that is now gone from the screen. So the dialog
 *    stays OPEN and the run's disposition is expressed the narrow way instead:
 *    `retryable === false` withdraws the submit affordance (the flat footer
 *    swaps Submit for a single Close; an `object-form` step drops `showSubmit`,
 *    which also stops a second Save from creating a DUPLICATE record — its
 *    first one was already persisted before the resume failed). Nothing offers
 *    a retry that cannot work; the input and the reason stay on screen
 *    together.
 * 2. **The message had one carrier, and it was the transient one.** The toast
 *    is kept — it is the console's failure idiom and it is viewport-fixed, so
 *    it survives a tall `object-form` step scrolled past its own header — and
 *    an inline destructive `Alert` (`role="alert"`) now carries the same
 *    sentence inside the dialog, next to the values that produced it.
 * 3. **Success invalidated the wrong thing.** Both hosts answer `onComplete`
 *    with `notifyDataChanged({ objectName: <this page's object> })`, which is
 *    the record the user is LOOKING at — never the record the flow WROTE. The
 *    reported run created a `crm_quote` from an Opportunity page, so the
 *    related list that would now contain it was never told, and the quote did
 *    not appear until a manual reload. This component cannot know which objects
 *    a flow touched (reading that out of the flow's output is a contract
 *    question, deliberately not answered here), so it invalidates `'*'` — the
 *    same scope, for the same stated reason, that `RecordDetailView`'s manual ⟳
 *    uses: everything mounted refetches in place over the #2269 bus, with no
 *    remount, so tab / scroll / inline-edit state all survive (AGENTS.md §5 #8).
 *
 * Copy goes through `@object-ui/i18n` (via the `@object-ui/react` re-export)
 * like its neighbours; the only English left in this file is the inline
 * `defaultValue` each key carries, which `check:i18n-keys` pins to its `en`
 * value. The server's own refusal sentence is passed through untranslated by
 * design — it is prose the backend composed, not a string with a key.
 */
import { Suspense, useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
} from '@object-ui/components';
import { notifyDataChanged, useObjectTranslation } from '@object-ui/react';
import { toast } from 'sonner';
import { ScreenView, isObjectFormScreen, initialScreenValues, visibleScreenFields, type ScreenSpec } from './ScreenView.js';
import { interpretFlowResponse } from '../utils/flowResponse.js';

export type { ScreenSpec, ScreenFieldSpec } from './ScreenView.js';

export interface ScreenFlowState {
  flowName: string;
  runId: string;
  screen: ScreenSpec;
}

/**
 * A refused resume, held so the dialog can show it beside the input that
 * produced it. `retryable` is `interpretFlowResponse`'s verdict, forwarded
 * unchanged: `false` means the suspension is gone and no resubmit of this run
 * can succeed, so the submit affordance is withdrawn (see the header note).
 */
interface ResumeError {
  message: string;
  retryable: boolean;
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
  const { t } = useObjectTranslation();
  const [screen, setScreen] = useState<ScreenSpec | null>(null);
  const [runId, setRunId] = useState('');
  const [flowName, setFlowName] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resumeError, setResumeError] = useState<ResumeError | null>(null);

  useEffect(() => {
    if (state) {
      setScreen(state.screen);
      setRunId(state.runId);
      setFlowName(state.flowName);
      setValues(initialScreenValues(state.screen));
      // A fresh run must not open under the previous run's refusal.
      setResumeError(null);
    }
  }, [state]);

  if (!state || !screen) return null;

  const setVal = (name: string, v: unknown) => {
    setValues((p) => ({ ...p, [name]: v }));
    // Editing is the start of a retry, so the banner it answers goes — but only
    // where a retry exists. A terminal refusal must stay on screen: its whole
    // job is to explain why the (now absent) Submit is not coming back.
    setResumeError((e) => (e && e.retryable ? null : e));
  };

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
      // Two carriers on purpose (#5417): the toast is fixed to the viewport and
      // reaches a user scrolled to the bottom of a tall object-form step; the
      // inline Alert stays with the values that caused it.
      toast.error(outcome.error);
      setResumeError({ message: outcome.error, retryable: outcome.retryable });
      return;
    }
    setResumeError(null);
    if (outcome.kind === 'paused') {
      setScreen(outcome.screen);
      setRunId(outcome.runId || runId);
      setValues(initialScreenValues(outcome.screen));
      toast.success(t('flowRunner.nextStep', { defaultValue: 'Saved — next step' }));
    } else {
      // Terminal success — show the flow's declared completion message.
      toast.success(
        outcome.successMessage
          || t('flowRunner.completed', { flow: flowName, defaultValue: 'Flow "{{flow}}" completed' }),
      );
      // The flow may have written ANY object — a quote created from an
      // Opportunity page lands in a related list this component cannot name.
      // See the header note on why the scope is `'*'` and not the host record.
      notifyDataChanged({ objectName: '*' });
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
      toast.error(
        t('wizard.missingRequired', {
          fields: missing.map((f) => f.label || f.name).join(', '),
          defaultValue: 'Please complete the required fields: {{fields}}',
        }),
      );
      return;
    }
    setSubmitting(true);
    try {
      await resumeWith(values);
    } catch (err) {
      // The request never produced a response (network / abort), so the
      // suspension was not consumed — this one IS retryable.
      const message = (err as Error).message;
      toast.error(message);
      setResumeError({ message, retryable: true });
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
      const message = (err as Error).message;
      toast.error(message);
      setResumeError({ message, retryable: true });
    } finally {
      setSubmitting(false);
    }
  };

  const isObjectForm = isObjectFormScreen(screen);
  // The run is gone: this dialog can still be read and copied from, but nothing
  // in it may offer to resubmit. See the header note.
  const terminal = resumeError !== null && !resumeError.retryable;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className={isObjectForm ? 'sm:max-w-3xl max-h-[90vh] overflow-y-auto' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{screen.title || t('flowRunner.title', { defaultValue: 'Input' })}</DialogTitle>
          {screen.description && <DialogDescription>{screen.description}</DialogDescription>}
        </DialogHeader>

        {resumeError && (
          <Alert variant="destructive">
            {/* The server composed this sentence for a human — ADR-0112
                `error.message` is already user-grade prose ("Node 'create_quote'
                failed: … at most 2 decimal places"). It is passed through
                verbatim and untranslated: it is data, not copy with a key. */}
            <AlertDescription>{resumeError.message}</AlertDescription>
          </Alert>
        )}

        {/* The screen body pulls in lazily-loaded chunks (an `object-form` step
            mounts ObjectForm, whose field widgets are lazy). Without a boundary
            HERE, that suspension unwinds to the host's nearest <Suspense> — a
            route-level one on some surfaces — which swaps the whole page for a
            fallback and destroys the host's state, taking this dialog (and the
            run it is driving) with it. */}
        <Suspense fallback={<div className="py-6 text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</div>}>
          <ScreenView
            screen={screen}
            values={values}
            onValueChange={setVal}
            dataSource={dataSource}
            objects={objects}
            objectForm={{
              onSuccess: onObjectFormSaved,
              onCancel: onClose,
              // Withdrawn once the run is gone: the record this step created was
              // already persisted, so a second Save would duplicate it AND still
              // have no suspension to resume.
              showSubmit: !terminal,
              showCancel: true,
              submitText: t('flowRunner.saveAndContinue', { defaultValue: 'Save & Continue' }),
              cancelText: terminal
                ? t('common.close', { defaultValue: 'Close' })
                : t('common.cancel', { defaultValue: 'Cancel' }),
            }}
          />
        </Suspense>

        {!isObjectForm && (
          <DialogFooter>
            {terminal ? (
              <Button variant="outline" onClick={onClose}>{t('common.close', { defaultValue: 'Close' })}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} disabled={submitting}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting
                    ? t('flowRunner.submitting', { defaultValue: 'Submitting…' })
                    : t('common.submit', { defaultValue: 'Submit' })}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
