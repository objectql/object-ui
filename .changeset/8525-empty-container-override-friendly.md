---
'@object-ui/components': patch
---

fix(components): `Empty`'s base classes stop beating a caller's padding on desktop, and drop an inert `border-dashed`

The shared `Empty` container carried `p-6 … md:p-12` in its base classes. A caller's unprefixed padding override (`px-3 py-8`, `py-10`, even a full `p-4`) lives in a different `tailwind-merge` variant from `md:p-12`, so `cn()` kept both and the `md:` rule won the cascade from 768px up — "tighten this panel" silently did nothing on any desktop viewport. The responsive default now travels in a custom property (`--empty-padding`: 24px, and 48px from `md`) read by ONE unprefixed `padding` utility, so a caller's plain padding wins at every viewport, while a site with no override renders exactly as before: 24px below `md`, 48px at and above it. Callers that are responsive themselves (`p-2 md:p-4`) keep working.

Visible consequence: the three console sites that already wrote a tighter panel now get it on desktop — the AI chat conversations sidebar's empty state (`px-3 py-8`) and the metadata-admin audit panel's error and empty states (`py-10`).

`border-dashed` is removed from the same string. It set only `border-style`; with preflight's zero `border-width` and no width supplied by any call site or ancestor, it drew nothing at any of the 44 `Empty` sites (measured on the console build), so removing it changes no pixel. No border width is added — a dashed frame around every empty state would be a product-wide visual decision that needs its own card.
