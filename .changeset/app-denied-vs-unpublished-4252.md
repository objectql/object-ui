---
'@object-ui/data-objectstack': minor
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

An app you are not allowed to open now says so, instead of reporting that it may still be publishing

`GET /api/v1/meta/apps` is filtered per session server-side (`filterAppForUser`), so an app withheld by its `requiredPermissions` and an app that does not exist were byte-identical to the console: both simply absent from the list. With one fact and two conditions, `AppContent` rendered its only copy for an absent app — "This app is not available yet — it may still be publishing. Try again in a moment." — over a permanent authorization decision, under a Retry button that could never succeed.

That is not a cosmetic complaint. On a downstream acceptance round one role hit this screen while another opened the same app fine, and because the copy names a transient deployment state the finding was filed as a suspected platform defect and carried through two test batches before a clean-baseline investigation found the account was missing a permission-set binding. The gate had been working exactly as designed; the message is what sent everyone to the wrong place.

The maintainer ruling (2026-08-12) took the contract half first. objectstack#8013 made the BY-NAME route answer an explicit denial — `403` with the ADR-0112 catalog code `PERMISSION_DENIED` in the declared `{ success: false, error: { code, message } }` envelope — for an app that exists and whose `requiredPermissions` the session lacks, while the LIST route stays filtered exactly as before, with no `authorized: false` flag, so the enumeration surface is not widened past what a direct by-name probe already implies. Absence keeps answering `404 RESOURCE_NOT_FOUND`, and so do the two neighbouring refusals the same ruling deliberately left alone: an unpublished app (ADR-0045 §3 keeps it externally unobservable) and an app gated by an absent optional service (ADR-0057 D10 — nothing was denied to the caller).

This is the console half. When a requested app is missing from the list and the existing post-publish readiness re-check still cannot find it, the console asks the by-name route which of the two it is, through a new `ObjectStackAdapter.probeAppAccess(name)`. On the measured code it renders a plain authorization message with a way back to the launcher; on anything else — an absent app, an unreachable server, a host that injected a DataSource without the probe — today's publishing copy renders byte for byte, retry button included.

Two properties of that seam are load-bearing rather than incidental. It branches on the ADR-0112 **code**, never the status (objectui#4408): the two answers under test are both errors one status apart, and a status-reading implementation passes the happy path while going blind exactly where the defect lives. And only `denied` moves the copy: this bug exists because the console asserted a state it had not measured, so a probe that fails, times out or cannot be issued must leave the screen alone rather than guess in the other direction.

`probeAppAccess` is deliberately separate from `getApp` rather than a flag on it: `getApp` degrades every failure to `null` — the very conflation being undone — and memoises in the adapter's metadata cache, where a verdict about the CALLER would outlive the session it described. New public API on the adapter (`probeAppAccess`, `isAppPermissionDeniedError`, `APP_PERMISSION_DENIED_CODE`, `AppAccessVerdict`), purely additive; nothing existing changed shape. Three new `empty.*` keys ship in all ten locale packs.
