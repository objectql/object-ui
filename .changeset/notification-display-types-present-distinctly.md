---
"@object-ui/react": minor
"@object-ui/components": minor
---

feat(notifications): each spec `displayType` gets its own presentation instead of a toast (#3014)

#3008 closed the **contract** half of this: `NotificationContext`'s union matched
`NotificationTypeSchema`, and `notify()` materialized the declared type so a
consumer *could* branch on it. Nothing did. `NotificationProvider` handed every
item to the host's `onToast` delegate regardless of type, so an author picking
`banner` or `inline` got a transient overlay — plausible output, wrong output.

Each of the five spec types now has a presentation of its own:

| `displayType` | Presentation | Rendered by |
|---|---|---|
| `toast` | transient overlay (unchanged) | the host's `onToast` delegate |
| `snackbar` | bottom-anchored bar, one at a time, at most one action | `<NotificationSnackbar />` |
| `banner` | page-width strip **in the content flow** | `<NotificationBanners />` |
| `alert` | blocking acknowledgement dialog, FIFO queue | `<NotificationAlerts />` |
| `inline` | in place, at the raising surface | `<NotificationInline scope="…" />` |

The four surface components ship from `@object-ui/components` and subscribe via
`useNotificationsByPresentation(type, scope?)`.

**Answers to the three questions the issue left open:**

1. **Banner/inline placement is the host's.** They are not overlays: a banner takes
   space at the top of the content area and an `inline` notification belongs next to
   the thing that raised it. So the context exposes the items and the surfaces
   subscribe, rather than one `onToast`-style delegate positioning everything. An
   `inline` notification carries a `scope` that pairs it with its outlet, so two
   forms on one page don't show each other's messages.
2. **`alert` is modal-ish but NOT the action system's `ModalHandler`.** That handler
   resolves a page/object, renders it, and reports an `ActionResult` back to the
   `ActionRunner`; a notification alert has no schema, no target and no result.
   Routing it there would mean synthesizing a page just to say "OK". It renders
   through the `AlertDialog` primitive instead — no second action-modal path.
3. **`snackbar` earns its own component.** It supersedes rather than stacks, anchors
   bottom regardless of the toast position config, and takes at most one action.
   Making it a sonner variant is what "presents as a toast" means.

**Also fixed:** auto-dismiss now follows the presentation. `toast`/`snackbar` keep
the transient timer; `banner`/`alert`/`inline` are persistent unless the raiser sets
`duration` explicitly — a persistent banner used to evaporate on the shared 5s toast
timer. `dismissible` is honored on the persistent surfaces (an `alert` always keeps
its acknowledge button; `dismissible: false` only closes the Escape route).

`onToast` now receives **only** `toast` items. A provider with no `onToast` remains
the supported store-only mode (a bell reading `notifications`/`unreadCount`), but
raising one of the other four types with its surface unmounted warns in dev, naming
the component to mount — that failure used to be silent.

`NOTIFICATION_PRESENTATIONS` is typed `Record<NotificationPresentation, …>`, so a new
member in the spec enum fails type-check until its presentation is decided; a parity
test additionally asserts the table covers `NotificationTypeSchema` exactly and that
no two types share a surface.
