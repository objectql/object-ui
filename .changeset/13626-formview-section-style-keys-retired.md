---
'@object-ui/plugin-form': minor
---

Retire the form-view section `className` / `gridClassName` reads (objectstack#13626,
maintainer ruling 2026-09-01, director decision batch C).

**Breaking, deliberately.** A `className` or `gridClassName` authored on a form-view
section no longer has any effect. Before this change an authored `gridClassName`
reached the section's field-grid `<div>` and an authored `className` reached the
section wrapper / divider header; both are now dropped at the renderer.

The two keys sit on the SDUI-only side of the authorable boundary: `@objectstack/spec`
deliberately does not declare either on the form-view/section surface (its
`component.zod.ts` says so in as many words) and the authorable-surface ledger carries
no entry for them. The renderer nevertheless reached them off the parsed view through
`as any` at seven sites — the boundary declared on one side and crossed on the other,
with the two repos each deliberate and in opposite directions.

Declaring the keys instead was weighed and **not** adopted: it would formally invite
free Tailwind strings into authored metadata, the exact class the boundary exists to
keep out — and per ADR-0065 / ADR-0080 (rev. 2026-06-30) utility classNames in runtime
metadata are never scanned by the build-time Tailwind, so they silently produce no CSS
anyway. Declaring them would have published a styling surface whose most obvious use
does nothing. If per-view styling becomes a real product need it gets an explicit
controlled token surface, not two leaked keys.

**Migration.** Nothing in the measured corpora has to change. A census across the
objectstack corpus, this repo's corpus, and the hotcrm application found **zero**
authored uses of either key on a form-view section (201 authored section nodes reached,
0 carrying either key). If you author them in your own metadata, move the styling to
the host application's own CSS, or to the form ROOT `className` — which is a different
key on a different node and is **unaffected** by this change.

Six sites in `ObjectForm` (the tabbed / wizard / split / drawer / modal section maps and
the stacked section-divider) and one in `DrawerForm` (its own divider) stop copying the
keys. The omission is pinned behaviourally across all seven arms rather than by a source
grep, because `ObjectFormSection` still declares both keys — so a later uncast
`className: s.className` would type-check and silently restore consumption.
