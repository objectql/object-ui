---
"@object-ui/app-shell": patch
---

feat(console-ai): mobile chat sheet bridges to full-page /ai (conversation history + share) — cleanly (ADR-0057 UX #2477 item 1)

The mobile chat bottom sheet gets a maximize button back — it opens the
full-page `/ai`, which on mobile already carries the conversation-history
sidebar and share, so the sheet doesn't need a second copy of either. This is
the missing mobile path to switch/resume threads.

The button navigates **deferred**: an earlier cut jumped straight from the
click and tore the still-open Radix sheet down mid-close (the route change
unmounts the console synchronously, leaking the sheet's scroll-lock/overlay
onto the destination — "tap maximize → the chat's just gone"). Now the click
only closes the sheet; a `useEffect` fires the navigation once `open` has
flipped false — after Radix released the body on that commit and before the
sheet unmounts — so `/ai` lands clean. Applies to both the console sheet
(→ `/ai`) and the Studio copilot sheet (→ `/ai/build?package=…`, same thread).

Live Canvas on mobile `/ai` (the beside-chat split has no room on a phone) is
tracked separately (#2481).
