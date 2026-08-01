---
"@object-ui/app-shell": minor
---

Stop declaring 28 app-shell symbols under names `@objectstack/spec` owns
(objectui#3157, objectstack#4115 batch 3).

**Breaking for importers of `@object-ui/app-shell`** — eight exported names
changed, because the spec exports the same name for a *different* thing:

| was | now | what the spec's same-named export actually is |
|:--|:--|:--|
| `FieldInput` | `ScreenFieldInput` | the authoring shape of an object FIELD |
| `ConversationSummary` | `ConversationListItem` | the AI context-compaction record |
| `RuntimeConfig` | `AppShellRuntimeConfig` | the ENGINE runtime config |
| `PageHeaderProps` | `PageHeaderComponentProps` | the authored SDUI page-header schema |
| `FlowNode` / `FlowEdge` | `FlowDesignerNode` / `FlowDesignerEdge` | a COMPLETE authored flow node/edge |
| `PackageManifest` | `PackageManifestRow` | the full authored package manifest |
| `InstalledPackage` | `InstalledPackageRow` | the full install record |

The object designer's `FieldGroup` also becomes `ObjectFieldGroup` — that is
the spec's own name for this exact shape, while its `FieldGroup` is the Studio
field-editor's group config. The other nineteen keep their names and are now
imported or derived from the spec instead of re-declared.

**Three live defects the copies were hiding**, all fixed by importing the real
types:

- `SchemaDiffEntryKind` was missing `index_mismatch` and `unmapped_index`
  (framework#3728). The federation validate panel renders a label per kind from
  a total map, so an index divergence — which the server already emits — arrived
  as a diff row this UI could not name. The union is now the spec's, and the
  compiler required the two missing labels.
- `ExplainLayer.contributors[].state` (`'active' | 'expired'`) did not exist in
  the local copy of the access-explain report, so an EXPIRED permission-set or
  position contribution rendered identically to a live one.
- `ExternalColumn.primaryKey` was optional locally while the server always sends
  it (the spec schema defaults it), and `ExplainRecordAttribution.rules` /
  `ExplainDecision.principal.positions` / `.permissionSets` were optional here
  and required there — every reader carried a nullish branch that could not fire.

The comment justifying the largest copy ("kept local so app-shell does not take
a build dependency on the framework spec package") was already false:
`@objectstack/spec` is a direct dependency of this package.

Two symbols are derived structurally rather than re-exported, each with one
documented divergence pinned by a test: `ScreenSpec` keeps `fields` optional
(an `object-form` step legitimately sends none — #3528), and `DecisionOutputDef`
adds `required`, which the server enforces but the spec does not yet model.
Deriving the latter also narrowed its `type` from a bare `string` to the spec's
closed enum, so a typo'd picker kind now fails to compile instead of silently
degrading to a raw record-id text box (objectui#2955).
