---
"@object-ui/console": patch
"@object-ui/app-shell": patch
---

fix(console): let a screen flow be completed from the developer Flow Runs page (framework#3528)

Developer → Flow Runs triggers a flow and renders the result. For a **screen**
flow that result is not a result — it is `{ status: 'paused', runId, screen }`,
and the run sits suspended until something posts to its resume endpoint. The
panel dumped that envelope as JSON and stopped: no screen, no Submit, no resume
call. Every test run of a screen flow left an orphaned `paused` row in Recent
Runs, and there was no way to drive one to completion from this surface.

- **console** — a paused test run now opens the same `FlowRunner` the record and
  list surfaces use, so the screen renders for real (flat fields, multi-step
  wizards, and `object-form` steps with their master-detail grids) and Submit
  posts to `/automation/:flow/runs/:runId/resume`. Dismissing the runner no
  longer strands the run: the pause is durable, so the panel keeps a "Continue
  run" affordance to reopen the pending screen. `paused` also gets its own
  status badge instead of falling through to the unknown-status style.
- **app-shell** — `FlowRunner` (and its `ScreenFlowState` / `ScreenSpec` types)
  is now exported from the package so surfaces outside `views/` can mount the
  one screen-flow runner rather than reimplementing it.
- **app-shell** — `FlowRunner` now wraps the screen body in its own `<Suspense>`
  boundary. An `object-form` step mounts `ObjectForm`, whose field widgets are
  lazy; that suspension used to unwind to the *host's* nearest boundary, and on
  a surface whose nearest boundary is the route-level one, React swapped the
  whole page for the fallback and remounted it — destroying the host's state
  along with this dialog. The screen vanished before it could be filled in and
  the run stayed paused with no resume call, which is exactly the "Submit does
  nothing" shape. Reproduced on the Flow Runs page and fixed at the source, so
  every host that mounts the runner is covered.
- **app-shell** — a screen payload without `fields` no longer throws. `fields`
  is optional on the wire (a message-only screen, or an `object-form` step from
  a node executor that omits it), but `FlowRunner`/`ScreenView` read it
  unguarded and blew up as the dialog mounted. Reads now go through a
  `screenFields()` helper; the design-time builder keeps its exhaustive shape.
