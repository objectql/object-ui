---
'@object-ui/components': patch
---

`action:button`, `action:icon`, `action:group` and `action:menu` now forward the
declared `onSuccess` block, so the post-success navigation an author writes in metadata
actually happens on those four surfaces (objectui#5493).

`onSuccess` — spec's closed strict `{ navigate, openIn }` object — became authorable on
`ActionSchema` with the `@objectstack/spec` 17.1.0 pin bump (objectui#5328), and the
runner has read it off the **forwarded** def since objectui#5221:
`ActionRunner.handlePostExecution` → `readOnSuccessNavigation` → `navigateOnSuccess`,
which hops through the app's own `navigationHandler` (a real SPA route change, immune to
popup blocking). Between those two halves sat these four forward whitelists, which never
carried the key. The action succeeded, the toast said so, and the declared hop silently
did not happen — the same "shipped green while dropped one hop before the runner" class
as `bodyExtra` (objectstack#6837), `bodyShape` (objectstack#6938) and `resultDialog`
(objectui#3646).

Reachability before this change was a function of which host rendered the action: the
full-def-spread hosts (`DeclaredActionsBar`, `ObjectGrid.onActionDef`,
`RelatedRecordActionsBridge`, `useNavActionDispatch`) already carried it through, so the
same declaration hopped there and did nothing here — and on an `action:bar`, whether an
action lands inline (`action:button`) or in the overflow (`action:menu`) is decided by
`maxVisible`, 3 desktop / 1 mobile. The declared navigation therefore depended on
viewport width.

Pinned end to end in
`packages/components/src/renderers/action/__tests__/action-onSuccess-forward.test.tsx`:
one row per surface drives the real renderer through the real runner and asserts the
`${result.*}`-interpolated url reaches `onNavigate`, with `openIn` exercised on both
branches. Each row asserts the action executed first, so a zero-navigation reading
cannot be a harness that did nothing.

The four matching `KNOWN_GAPS` entries in `scripts/check-action-forward-parity.mjs` are
deleted — that ledger is ratcheted, so a stale entry excusing a key that is now
forwarded fails the gate. `element:button` is untouched and stays correct: `onSuccess`
is not on spec's `InlineActionSchema` pick list, so that surface never owed it.
