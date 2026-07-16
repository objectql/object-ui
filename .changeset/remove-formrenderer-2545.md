---
"@object-ui/react": minor
---

remove(react): drop the unused `FormRenderer` / `FieldFactory` duplicate render path (#2545)

`FormRenderer` (and its captive `FieldFactory`) was an exported-but-dead second
form render path: zero runtime consumers anywhere in the repo — the only import
was its own test file. It duplicated `@object-ui/plugin-form`'s `ObjectForm`
(the path every app actually uses via the component registry) but had drifted
into a degraded variant: raw-HTML/Tailwind instead of the shared UI primitives,
a hard-coded Submit button, and no support for `submitBehavior` / `aria` /
`groups`.

**Breaking (ships as minor per the pre-1.0 launch-window convention):** the
public exports `FormRenderer`, `FormRendererProps`, `FieldFactory`,
`FieldFactoryProps`, and `ExtendedFormField` are removed from
`@object-ui/react`. Render forms through the `object-form` schema node
(`@object-ui/plugin-form` `ObjectForm`, reachable from a `FormViewSchema` via
`SchemaRenderer` / the spec bridge) instead. Closes Phase 4 of #2545.
