---
"@object-ui/app-shell": patch
---

fix(studio): show a failed flow run's reason in the Runs panel (string errors)

The Studio flow **Runs** panel (`FlowRunsPanel`) rendered a run-level error as
`run.error?.message`, but the automation engine sends `ExecutionLog.error` as a
plain **string** — so `.message` was always `undefined` and the failure reason,
the single most useful thing about a failed run, was silently dropped. This grew
important now that runs are durable (framework #2581): a failed run persists with
its reason, but the panel showed only a red "Failed" badge and no "why".

The panel now normalizes an error through a small `errorText()` helper that
accepts **either** a string (the run-level shape) **or** a `{ code, message }`
object (the step-level shape), and uses it for both the run summary and each
step row. Verified with a jsdom render test (a failed run's string reason reaches
the DOM) and live in the browser against a real failed run (`showcase_resilient_sync`):
the reason now displays where it previously showed nothing.
