---
'@object-ui/components': patch
---

`KbdGroup` now declares its props as `React.ComponentProps<"kbd">`, the element it
has always rendered, instead of `React.ComponentProps<"div">` (objectui#8576). The
rendered output is unchanged — this component has always put a `kbd` in the DOM,
and upstream shadcn ships the same element.

Unlike the sibling repair in objectui#8571, this one is visible to TypeScript, and
that was measured rather than assumed (TypeScript 6.0.3, `@types/react` 19.2.18):
`ComponentProps<"div">` and `ComponentProps<"kbd">` are NOT the same type, where
`ComponentProps<"div">` and `ComponentProps<"p">` are. The prop NAMES are identical
(`HTMLAttributes` is one interface for every element); what moves is the element
type parameter, so `ref` and `currentTarget` are now `HTMLElement` rather than
`HTMLDivElement`.

For consumers this widens the props type rather than narrowing it: everything that
type-checked before still type-checks, including a `div`-typed `ref` — an
`HTMLDivElement` ref object or ref callback is still accepted, and it receives the
`kbd` that has always been rendered. The one member `HTMLDivElement` adds over
`HTMLElement` is the deprecated `align`, so code reading that off an inferred
`ref` / `currentTarget` is the only shape that moves.
