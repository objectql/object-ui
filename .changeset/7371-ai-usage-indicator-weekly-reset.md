---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

Fix `AiUsageIndicator` to recognize the free plan's new `resetKind: 'weekly'` and its
`resetsAt` (objectui#7371, consumer of cloud PR #1852's rolling 7-day AI quota window).

Before this change a `weekly` meter fell through to the component's unrecognized-kind
path and rendered no reset line at all — not a crash, but silently wrong information
next to a live progress ring. The indicator now shows "Resets in N days" (or "Resets in
N hours" once inside the final day, e.g. `console.ai.usage.resetsWeeklyHours`), computed
from the endpoint's `resetsAt`, in both languages via `@object-ui/i18n`
(`console.ai.usage.resetsWeeklyDays` / `resetsWeeklyHours`, real i18next plural families
with a base key so every locale pack resolves correctly, all ten packs translated). D5 is
preserved — no token count is ever rendered, only the days/hours until reset.

Contract-first: `resetsAt` is read verbatim from the endpoint, never re-derived or
guessed client-side. A `weekly` meter with `resetsAt: null` (nothing counted yet in the
window) and any `resetKind` this build does not recognize both render no reset line —
fail-soft, not a crash or stale copy.

`AiUsageResetKind` (`packages/app-shell/src/hooks/useAiUsage.ts`) gains the `'weekly'`
member; `resetsAt` was already `string | null` and needed no shape change.
