---
title: Notifications
description: The five spec display types and the surface that renders each
---

# Notifications

ObjectUI's notification system implements the spec `NotificationSchema`
(`@objectstack/spec` → `ui/notification.zod.ts`). A notification carries two
independent axes:

- **`severity`** — `info` / `success` / `warning` / `error`. Picks the icon and tone.
- **`displayType`** — `toast` / `snackbar` / `banner` / `alert` / `inline`. Picks the
  **surface**: where and how it appears.

`displayType` used to be stored and never read, so every type surfaced as a
toast — an author asking for a `banner` got a transient overlay. Each type now
has a presentation of its own.

## The five presentations

| `displayType` | Presentation | Rendered by | Persists |
|---|---|---|---|
| `toast` | Transient overlay | the host's `onToast` delegate (sonner in the console) | no — auto-dismiss |
| `snackbar` | Bottom-anchored bar, one at a time, at most one action | `<NotificationSnackbar />` | no — auto-dismiss |
| `banner` | Page-width strip **in the content flow** | `<NotificationBanners />` | yes — until dismissed |
| `alert` | Blocking acknowledgement dialog, FIFO queue | `<NotificationAlerts />` | yes — until acknowledged |
| `inline` | In place, at the surface that raised it | `<NotificationInline />` | yes — until dismissed |

Auto-dismiss follows the presentation, not a single global timer: `toast` and
`snackbar` are transient (`config.defaultDuration`, 5s by default), the other
three stay until dismissed. An explicit `duration` always wins — including
`duration: 0`, which makes a toast persistent.

## Mounting the surfaces

`toast` is delegated to the host; the other four are React components that
subscribe to the provider. Placement is deliberately yours: a banner needs a
slot in the content area and an inline notification belongs next to the thing
that raised it, so neither can be positioned by a global overlay.

```tsx
import {
  NotificationAlerts,
  NotificationBanners,
  NotificationInline,
  NotificationSnackbar,
} from '@object-ui/components';
import { NotificationProvider } from '@object-ui/react';
import { toast } from 'sonner';

<NotificationProvider
  config={{ position: 'top_right', defaultDuration: 5000, maxVisible: 5 }}
  onToast={(n) => toast[n.severity](n.title, { description: n.message })}
>
  <main>
    <NotificationBanners />   {/* top of the content area */}
    <Outlet />
  </main>
  <NotificationSnackbar />
  <NotificationAlerts />
</NotificationProvider>
```

A provider with **no** `onToast` is a supported "notification centre" mode: items
are collected in `notifications` / `unreadCount` for a bell or list, and nothing
is overlaid. Raising one of the other four types with its surface unmounted is a
mistake, though — dev builds warn, naming the component to mount.

### In the console

`@object-ui/app-shell` already does this wiring — a console route can call
`useNotifications()` and every display type presents correctly with no setup:

| Surface | Mounted by |
|---|---|
| `toast` | `ConsoleShell`, via `presentNotificationToast` → sonner (`ConsoleToaster`) |
| `snackbar`, `alert` | `ConsoleShell` — both have a single global home |
| `banner` | `ConsoleLayout`, at the top of the content area, beside the draft / unpublished bars |
| `inline` | nothing, by contract — the raising surface mounts its own `<NotificationInline scope="…" />` |

Assembling a shell by hand? Both pieces are exported: `presentNotificationToast`
for the `onToast` delegate, and `ConsoleNotificationBanners` — `NotificationBanners`
guarded by `useHasNotificationProvider()`, so a layout rendered without the
provider above it renders no banners instead of throwing.

## Raising notifications

```tsx
const { notify } = useNotifications();

notify({ title: 'Saved', severity: 'success' });                    // toast (spec default)
notify({ title: 'Row deleted', severity: 'info', displayType: 'snackbar',
         actions: [{ label: 'Undo', onClick: undo }] });            // one action
notify({ title: 'Viewing a draft', severity: 'warning', displayType: 'banner' });
notify({ title: 'Session expired', severity: 'error', displayType: 'alert' });
```

### `inline` and `scope`

An inline notification is rendered by the surface that raised it. `scope` is the
routing key that pairs the two, so two forms on one page don't show each other's
messages:

```tsx
notify({
  title: 'Fix 2 fields', severity: 'error',
  displayType: 'inline', scope: 'contact-form',
});

<NotificationInline scope="contact-form" className="mb-4" />
```

Omit `scope` on both ends for a page-level inline outlet. `scope` is renderer-local
routing metadata, not a spec field — the spec describes what a notification *is*,
not which React subtree hosts it.

### `icon`

Every surface — including the console's sonner toast — resolves `icon` through
the same rule: a declared Lucide name (kebab-case or PascalCase) replaces the
severity icon; anything else falls back to it.

```tsx
notify({ title: 'Deploy finished', severity: 'success', displayType: 'banner', icon: 'rocket' });
```

A name Lucide doesn't have costs the author their override and nothing more —
deliberately *not* the generic `Database` glyph `getLazyIcon` returns for
data-shaped schema slots, which on an error notification would replace a
meaningful icon with a meaningless one.

### `dismissible`

Defaults to `true`. On the persistent presentations, `dismissible: false` removes
the dismiss control (a banner you must resolve rather than wave away). An `alert`
always keeps its acknowledge button — `dismissible: false` only closes the Escape
route, never the way out.

## Notes

- **`alert` is not the action system's modal.** `ModalHandler` resolves a page or
  object, renders it, and reports an `ActionResult` back to the `ActionRunner`. A
  notification alert has no schema, no target and no result — it is a message and
  an acknowledgement, so it renders through the `AlertDialog` primitive instead.
- **`snackbar` is not a toast variant.** It supersedes rather than stacks, anchors
  to the bottom regardless of the toast position config, and carries at most one
  action.
- Adding a member to the spec `NotificationTypeSchema` fails type-check in
  `NOTIFICATION_PRESENTATIONS` (`@object-ui/react`) until its presentation is
  decided — new types cannot silently fall back to a toast.

## Server-side notifications

`useClientNotifications` bridges the `@objectstack/client` notifications API into
the same provider (ADR-0030). Fetched items are persistent and default to `toast`,
so a host that renders a bell from `notifications` needs no surface at all.
