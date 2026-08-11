---
'@object-ui/components': patch
---

An action rendered in the overflow menu, as an icon or inside a group now reaches the runner carrying the same authored keys as the same action rendered inline — `action:menu`, `action:icon` and `action:group` forward `label` and `description`, and the two group/icon surfaces also forward `resultDialog`.

Every action renderer hands the `ActionRunner` an explicit key WHITELIST rather than the action itself. That is deliberate — a key no renderer honours must not look wired — but the whitelists had drifted, and which renderer a given action gets is decided by `action:bar`'s `maxVisible` split (3 on desktop, 1 on mobile) and by `systemActions`, which are always in the overflow menu. So the same declared action behaved differently depending on the viewport.

`label` and `description` are what the console's param-collection handler titles its dialog from (`title: action?.label || action?.title`, `description: actionDescription(…, action?.description)`). Dropped, an action with declared `params` opened a dialog titled "Action parameters" while the SAME declaration rendered inline named itself "Create Environment". `resultDialog` is the one-shot reveal spec (a fresh 2FA code, a newly minted OAuth secret): dropped, the runner falls back to the success toast and the value the user was meant to copy is gone — the objectui#3646 defect, still live on two of the four declared surfaces.

`undoable` and `recordIdField` are deliberately NOT added. Both are read only under a `rowRecord` guard, and `rowRecord` is `params._rowRecord`, written exclusively by the spread-based hosts (`DeclaredActionsBar`, `RelatedRecordActionsBridge`, `ObjectGrid`, `page:header`), none of which dispatch through these renderers. They are unreachable on this path rather than dropped — `action:button` forwards them here inertly — so forwarding them would have added a second inert copy instead of restoring an affordance.

A new repo gate, `pnpm check:action-forward-parity`, now derives each surface's owed key set (`authorable ∩ runtime-read − retired`) from the spec's own schemas and the consumers' ASTs and fails when a renderer drops one, so the seventh instance of this class fails on the pull request that introduces it rather than shipping green.
