---
"@object-ui/core": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-view": minor
"@object-ui/app-shell": patch
"@object-ui/types": patch
---

refactor(views): ListView reads the spec-canonical `columns`, with legacy `fields` folded in one normalizer (#2890 scope A step 1)

`ListViewSchema` has been derived from `@objectstack/spec/ui` since #2231, but
the renderer still spoke objectui's own vocabulary for the same concepts. First
rename closed: **`fields` → `columns`**.

Legacy acceptance does not disappear — stored view metadata in user databases
carries `fields` — but it now lives in exactly one place instead of being
re-implemented per read-site:

- **New `normalizeListViewSchema` (`@object-ui/core`)** folds `fields` into
  `columns` (canonical wins when both are present) and drops the legacy key, so
  a read-site that was missed fails loudly instead of quietly taking the legacy
  path. It also absorbs the `viewType` renderability default ListView applied
  inline. Non-mutating, idempotent, and returns its input by reference when
  there is nothing to fold, so ListView's downstream memos keep a stable
  dependency identity.
- **`ListView` normalizes once at the component boundary**, before anything
  reads the schema. This is what guarantees the fold runs: nothing on the render
  path parses view metadata through zod (the zod schemas serve the CLI
  validator, the VS Code extension and tests), so a `z.preprocess` on
  `ListViewSchema` — spec-side or local — would never execute.
- **Producers emit `columns`**: `ObjectView`'s `renderListView` payload,
  `ObjectDataPage`, `InterfaceListPage` and the `list-view` registry defaults
  had been *downgrading* already-canonical `columns` config back to `fields`.

Two latent inconsistencies go away with it: the filter builder's
objectDef-not-loaded fallback now resolves `ListColumn.field` (it read only
`name`/`fieldName`, so object-form columns produced unnamed filter entries), and
the column list no longer depends on which of the two keys a host happened to
emit.

`fields` stays declared on `ListViewSchema` and in the drift guard's sanctioned
set — it is still valid input, and `@objectstack/spec`'s `react-blocks.ts`
sanctions it as the React-tier `<ListView fields>` prop — but it is input-only.
