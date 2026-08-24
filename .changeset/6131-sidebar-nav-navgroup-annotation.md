---
---

Docs only, publishes nothing: the "Complete Example" block in
`content/docs/layout/sidebar-nav.mdx` now annotates its grouped-navigation array as
`NavGroup[]`, importing the type in the same block (objectui#6131).

Without the annotation the array's `badgeVariant: 'destructive'` widens to `string`,
and `SidebarNav`'s declared `badgeVariant?: 'default' | 'destructive' | 'outline'`
does not accept it — so the whole array fails to assign to
`items: NavItem[] | NavGroup[]`. TypeScript then reports the union's *other* branch,
which is why the message reads "missing the following properties from type 'NavItem':
title, href" and looks at first like a wrong data shape. The data shape was always
right; the annotation was missing. A reader who copies this block into an annotated
position, or assigns it anywhere typed under `strict`, hits the same TS2322.

Measured on this branch against the built `dist/*.d.ts`, with the block temporarily
re-fenced as `ts` under an `EXIT` trap so it joins the compile population (the fence
itself belongs to objectui#5867's lane and is deliberately left as `plaintext` here):

- before the annotation, `Semantic phase: 224 of 224 block(s) judged, 1 failed`, gate
  exit 1, on `content/docs/layout/sidebar-nav.mdx:235:7  TS2322`;
- after it, `Semantic phase: 224 of 224 block(s) judged, 0 failed`, gate exit 0.

Removing the annotation again reproduces the identical TS2322, so it is load-bearing
rather than decorative. Declared fragment count is unmoved at 111, no
`FRAGMENT_MARKER` is added, and the covered/ungated sets are untouched.

The annotation is written so that it **resolves**: the type is imported in the same
block, because every block compiles in isolation. An annotation naming a type the
block cannot see errors on the annotation itself, at which point TypeScript stops
checking the literal underneath and the TS2322 disappears — the false-green shape
already recorded for `guide/theming` in `scripts/check-doc-snippet-types.mjs`.

This clears the last `content/docs/layout` block that stays red for a reason of its
own, so the layout group is type-clean ahead of objectui#5867 re-fencing it.
