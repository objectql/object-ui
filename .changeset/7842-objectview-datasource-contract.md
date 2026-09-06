---
---

Comment-only truthfulness fix in `@object-ui/plugin-view`, plus its pin.
`ObjectViewProps.dataSource` promised "If not provided, falls back to
SchemaRendererProvider context" one line above a declaration that has always
been required, so one of the two had been wrong for the prop's whole life
(objectui#7842). Measured: the TYPE is right. `ObjectView` holds no context read
at all — no `useContext`, no `SchemaRendererContext`, and not
`useElementDataSource`, the hook `@object-ui/react` publishes for exactly this
fallback; the prop's value travels into `useSettledSchema` (no context read
either) and into two effects that GUARD on it rather than resolve one.

The sentence was misfiled rather than invented: `ObjectViewRenderer`, the
renderer registered for the `object-view` and `view` schema tags, is what really
reads `useContext(SchemaRendererContext)` and hands `ctx?.dataSource` down to
this prop. So a schema-driven host does get the provider's adapter; a caller
writing `<ObjectView …>` in TSX does not, and tsc refuses the omission at the
call site. The JSDoc now says that, says what happens when the prop is absent
anyway (every read site returns early, the value is forwarded verbatim to a
child whose own `dataSource` is optional, and the view renders empty rather than
throwing), and records that making the prop optional would widen a published
accept set.

The new pin keeps both halves: `ObjectView` under a real `SchemaRendererProvider`
never touches the provider's adapter (behind a live control that proves the same
probe DOES observe an adapter passed as the prop), and the registered renderer
still resolves one from context. No published behaviour changes and no
declaration moved.
