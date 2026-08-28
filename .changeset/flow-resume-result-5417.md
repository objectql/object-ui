---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

A screen flow's resume result reaches the user — on both outcomes (objectui#5417).

A dogfood walkthrough reported that a refused `resume` and a successful one
"render identically: the dialog closes and the page is unchanged", leaving no
gesture that distinguishes "created" from "rejected". Re-measured against `main`
before any change, one half of that was already fixed — `interpretFlowResponse`
reads the ADR-0112 envelope, and `FlowRunner`'s `toast.error` has carried its
prose since the `400 FLOW_FAILED` classification landed in `17.6.0`, five minors
after the version the report was measured on. There was no interpreter bug and
no un-consolidated fourth call site. Three gaps in the RUNNER's disposition were
real, and they are what changed:

- **A terminal failure no longer closes the dialog.** The reason it closed is
  unchanged and is not reversed: on a `FLOW_FAILED` the engine has already
  consumed the suspension, so a resubmit can only reach "No suspended run" and
  must not be offered. Closing was one way to withhold that dead retry and the
  expensive one — the user had just typed a form they could no longer see, and
  the engine's sentence names a value that left the screen with it. The dialog
  now stays open with the submit affordance withdrawn: the flat footer swaps
  Submit for Close, and an `object-form` step drops its Save (which also stops a
  second click from duplicating the record it had already persisted).
- **The refusal has a second, non-expiring carrier.** The toast stays — it is
  viewport-fixed, so it still reaches a user scrolled past a tall step's header
  — and an inline destructive `Alert` (`role="alert"`) now holds the same
  sentence inside the dialog, beside the values that produced it. A retryable
  refusal (`INVALID_SCREEN_INPUT`, transport, 5xx) keeps Submit live as before,
  and its banner clears as soon as the user starts editing.
- **A successful run invalidates what the flow WROTE, not just what the user is
  looking at.** Both hosts answered `onComplete` with
  `notifyDataChanged({ objectName: <this page's object> })`, so a flow that
  created a quote from an Opportunity page never told the related list that
  would now contain it — the record did not appear until a manual reload. The
  runner cannot know which objects a flow touched, so it emits
  `{ objectName: '*' }`: the same scope, for the same stated reason, that the
  record page's manual ⟳ already uses. Everything mounted refetches in place
  over the invalidation bus, with no remount.

The runner's copy now goes through `@object-ui/i18n` instead of being hardcoded
English: a new `flowRunner` namespace (`title`, `submitting`, `saveAndContinue`,
`nextStep`, `completed`) in all ten packs, plus reuse of
`common.{loading,cancel,close,submit}` and `wizard.missingRequired`. The
server's own refusal sentence is still passed through untranslated — it is prose
the automation engine composed for a human, not copy with a key.
