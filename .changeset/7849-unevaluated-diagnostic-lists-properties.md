---
"@object-ui/react": patch
---

The unevaluated-expression diagnostic now lists `properties` among the channels
that evaluate and read back, matching the sibling `props`-bag diagnostic that
tells authors to write their keys there.

Both messages are dev-build diagnostics in `SchemaRenderer`, and one node can
trip both. They disagreed: `propsBagDiagnostic` said *"`props` is NOT hoisted
onto the node — only `properties.*` is … Write them under `properties`
instead"*, while `unevaluatedExpression` enumerated *"channels that do evaluate
and read back today"* as `content` or host-side resolution — omitting
`properties`. An author who hit both was told to use a channel the other message
said did not work.

The enumeration was the wrong half, established by measurement rather than by
reading the `COMPAT` label on the hoist. `properties` has no retirement on
record: `@objectstack/spec@17.2.0` calls the vocabulary carried there *"ALIVE —
this is not dead surface to retire under ADR-0049"*, keeps
`PageComponentSchema.properties` as the open carrier on purpose, gates it at the
authoring door, and tombstones no part of it via `retiredKey()`. In this repo
`props`, not `properties`, is the spelling annotated as the legacy alias.

Diagnostic text only — no evaluation, hoist or schema behaviour changed.
