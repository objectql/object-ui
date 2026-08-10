---
'@object-ui/components': patch
---

An `autoTrigger` action that spills past `action:bar`'s `maxVisible` now still runs — `action:menu` consumes the flag instead of dropping it.

`autoTrigger` is the client-composed "run this action as soon as a renderer receives it" flag behind deep links like the welcome page's "Create your environment" CTA (#844). It was consumed only by `action:button`. `action:bar` splits its post-gate list at `maxVisible` (3 on desktop, 1 on mobile) and hands the tail to `action:menu`, which had no `autoTrigger` handling at all — so an auto-triggered action that happened to sort past that threshold was rendered as an ordinary "More" menu entry and never ran, while the caller had already spent the one-shot signal it stood for. The `?runAction=create_environment` deep link is consumed by stripping it from the URL, so the measured end state was `urlParam=null execute=0`: no dialog, and no URL left to retry from. Which actions lost their auto-trigger was partly a function of viewport width, since `maxVisible` drops to 1 on mobile, and `systemActions` — always in the overflow menu, whatever the viewport — could never fire one at all.

The flag's contract is now stated and enforced as "execute once on mount by whichever renderer receives the action". `action:menu` consumes it by EXECUTING, through the same path a click on that item takes; it does not open the dropdown, so a transport flag never moves what the user sees. Consumption happens where the action provably arrives — the menu renderer receiving it — not in the menu items, which Radix mounts only once the dropdown opens and which would therefore have waited on the very click the flag exists to avoid.

Once-ness has one implementation (`renderers/action/auto-trigger.ts`), now shared by both renderers rather than written twice: a guard ref per rendered action, so re-renders never re-fire it and a flag that flips true later still fires exactly once. Container visibility still governs mounting — a hidden `action:bar` or `action:menu` renders no children and auto-triggers nothing — while the action's own `visible` gate does not suppress the trigger, matching `action:button`'s long-standing behaviour so that a deep link cannot depend on where the bar happened to put the action.

The `action:bar` split, the inline `action:button` path and #4166's arming pins are unchanged.
