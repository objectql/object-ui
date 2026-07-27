---
"@object-ui/app-shell": patch
"@object-ui/plugin-dashboard": patch
---

fix(console): dispatch flow actions from every surface, and cover the screen-flow round trip (framework#3528)

The resume half of screen flows is fixed; these are the two launch-side holes
found while mapping every path that dispatches a `type: 'flow'` action — on
both, a screen flow could not even be started.

- **plugin-dashboard** — a dashboard header action only dispatched when its type
  was `modal` or `script`. `flow` (and `api` / `form` / `navigation`) fell
  through to `console.warn("Unknown header actionType")` and did nothing at all.
  The click handler now routes everything that is not a raw `url` navigation
  through the ActionRunner, which owns the type registry; there is nothing for
  the renderer to second-guess.
- **app-shell** — the console-root `<ActionProvider>` was mounted with no
  `handlers` map. It exists to give every field widget a modal handler, but an
  `ActionProvider` also decides what a `useAction()` consumer *below* it can
  dispatch, so any `action:button` outside ObjectView / RecordDetailView /
  PageView / DeclaredActionsBar bound to a runner that could only open modals:
  a `flow` action there failed with "Flow handler not registered", and `api` /
  `script` were equally dead. The root now carries the shared console runtime's
  api / flow / script handlers plus its confirm / param / result / screen-flow
  dialogs. `modal` deliberately stays on the client-side `useActionModal`
  handler — registering it in `handlers` would take precedence over `onModal`
  and reroute the inline-create affordance to `/api/v1/actions/...`.

Both changes ship with regression tests that were verified to fail without them.
Also adds the first coverage of the screen-flow seam itself, which had none:

- `FlowRunner.suspense.test.tsx` — a lazily-loaded screen body must not unwind
  past the dialog. Reproduces the real shape (lazy body, route-level boundary
  above the host, host state that must survive) and fails against the
  pre-boundary runner, which is how a paused run's screen used to vanish before
  it could be submitted.
- `e2e/live/screen-flow.spec.ts` — the live round trip: a row flow action
  triggers the run, the paused screen renders, Submit POSTs to
  `/automation/{flow}/runs/{runId}/resume` with the collected values, and the
  flow's downstream `update_record` shows up in the list. The unit tests stub
  the runner out of the action runtime and the runner's own tests feed it a
  screen directly, so trigger → dialog → resume → refresh was previously only
  ever exercised by hand.
