---
"@object-ui/react": minor
"@object-ui/components": minor
"@object-ui/app-shell": minor
---

fix(notifications): the config, `position` and action `variant` are read instead of forked or ignored (#3014 follow-up)

The last of the notification contract. After `displayType` (#3071) and `icon`
(#3076), four gaps of the same family were left:

- **the config was 3/4 inert** — only `defaultDuration` was ever read.
  `maxVisible` and `stacking` were carried and ignored, while
  `NotificationBanners` capped at a hard-coded `3` of its own;
- **its field names forked from `NotificationConfigSchema`** — `position` vs
  `defaultPosition`, a renderer-local `stacking` boolean with no spec
  counterpart, and no `pauseOnHover` at all;
- **a notification could not declare a `position`.** The #3008 parity guard
  asserted the position *vocabulary* matched the spec while nothing positioned
  anything by it — a guard passing over an unused value;
- **`NotificationActionButton.variant` was the shadcn Button vocabulary**
  (`default | destructive | outline`) under a spec-shaped name, forking
  `NotificationActionSchema.variant` (`primary | secondary | link`).

**How positioning resolves now** — `notification.position ?? config.defaultPosition
?? nothing`, and "nothing" is a real answer:

- **declared** → the surface pins itself there, always. `presentNotificationToast`
  passes it per-toast so the contract wins over the container;
- **undeclared** → the surface keeps its own anchor (a snackbar's bottom edge) or
  defers to the host's toast chrome.

That asymmetry is the design decision. The host's sonner container also serves
toasts that are *not* spec notifications (the console action runtime's own
`toast.*` calls), so it stays the fallback authority for placement — never a
competing one. A declared position a component prop could silently override
would be the same "validates, then does nothing" shape this whole area is about.
Hence `defaultPosition` has no fabricated default: "the host didn't say" has to
be representable.

Also: `maxVisible` / `stackDirection` now drive every stacking surface through
one shared `visibleNotificationStack` (cap keeps the NEWEST, stack grows in the
declared direction); `pauseOnHover` holds a transient notification's timer and
resumes it with the time it had left, which needed the provider to track live
timers rather than fire-and-forget `setTimeout`s. Legacy spellings still resolve:
`position` folds into `defaultPosition`, and `stacking: false` reads as
`maxVisible: 1` rather than being ignored.

`onToast` now receives the resolved config as a second argument, so the delegate
can apply the parts of the contract only it can. Existing one-argument handlers
are unaffected. The spec-parity guard gained the action-variant vocabulary, the
one notification enum it did not cover.
