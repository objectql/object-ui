---
'@object-ui/plugin-dashboard': patch
---

`DashboardRenderer`'s widget grid now passes only whitelisted DOM props to its container (objectui#4432)

`view:dashboard` resolves to this component, so `SchemaRenderer` handed it the dashboard node's own keys, the contents of the node's `props` container, the ARIA it resolved and the host's trailing props — and every key the component did not destructure was spread raw onto the grid container. React writes unknown lowercase attributes through in silence and stringifies object values, so the failure was invisible. Measured through the real SDUI path: **13 non-DOM attributes**, including `events="[object Object]"`, `props="[object Object]"` and a camelCase `arialabel` sitting next to the resolved `aria-label`, so the element carried each ARIA value twice under two spellings — one of them meaningless to assistive technology.

The container is now consume-or-whitelist per objectui#4425 phase 2: only `toDomProps`' output reaches the element, and it is spread FIRST so the component's own computed attributes stay authoritative. The resolved `aria-label` / `aria-describedby`, `role`, `id`, `tabIndex`, `className` and the `data-*` family still arrive — dropping them would have been an accessibility regression dressed as a leak fix, so the new pin asserts the delivered set exactly, not just the absent one. Both layout branches are covered: the responsive desktop grid and the mobile stack spread the same props onto the same host element.

Three behaviours move with the spread, all of them consequences of a trailing spread that used to override the component's own computed props:

- **`onClick` now has one carrier.** It is a declared DOM pass-through key AND this container computes a design-mode background handler, and the old spread let the incoming handler replace the computed one — so a host that passed `onClick` silently lost background deselection. Both run now, container affordance first. An authored non-function `onClick` (SDUI spells click behaviour `events: { onClick }`, which is data and is dropped) is ignored instead of handed to React, which used to throw on it.
- **An authored `style` no longer replaces the computed grid layout.** `style` is not in the SDUI pass-through set, and this container computes its own `gridTemplateColumns` / `gridAutoRows` / `gap`; an authored `style` used to overwrite all of it and collapse the grid.
- **An authored `data-user-actions` no longer overrides the value computed from the `userActions` prop.** The `data-*` family still passes the whitelist; only this one collision with a computed attribute resolves the other way now.

The injected `disabled` verdict is also dropped rather than forwarded. Nothing in this component ever read it: it only became a `disabled` attribute on a container element that has no such attribute, which is the leak, not a behaviour.
