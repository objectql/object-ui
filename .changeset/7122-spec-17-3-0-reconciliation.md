---
'@object-ui/app-shell': patch
'@object-ui/auth': patch
---

Reconcile `@object-ui/app-shell` with `@objectstack/spec` 17.3.0 (objectui#7122).

`SchemaDiffEntryKind` gained an `unreachable` member in 17.3.0, and the external
datasource validation panel labels those kinds through a map that is TOTAL over
the union on purpose — so an upstream addition fails the build rather than
rendering a blank cell. That mechanism fired: the package did not compile against
17.3.0 until the kind was labelled. It now reads "Not checked — remote
unreachable", following the spec's own ruling that this kind asserts nothing
about the remote schema and must never be surfaced as "schema changed": it means
introspection could not complete, which is often transient, and labelling it like
a mismatch would tell an operator to repair a schema nobody has read.

Two internal flow-inspector types were renamed (`FlowNodeLike` →
`InspectorFlowNode` / `ScopeFlowNode`) because 17.3.0 began exporting its own
`FlowNodeLike`; neither name is in this package's published entry, so no consumer
import changes.

`@object-ui/auth`: a README sentence claiming the preview-mode prop aligns with
the spec's `PreviewModeConfig` is corrected — 17.3.0 removed that symbol. The
`previewMode` prop itself is host-supplied, unchanged, and unaffected.
