---
'@object-ui/types': minor
'@object-ui/plugin-view': minor
'@object-ui/plugin-tree': patch
---

Export the host `tree` view config as `TreeViewConfig` (objectui#8253, director
decision batch #78, 2026-09-07, maintainer 「同意」 on option (a)).

**What was wrong.** `tree` is a host-composition-only view type — ruled deliberate on
objectui#5321, it is a member of neither `ObjectViewSchema.defaultViewType` nor
`NamedListView.type`, so the branch runs only when a host passes a `views` prop. On
that path a per-view `tree` block is read at four sites, and its only description
anywhere was a module-local, non-exported `interface TreeConfig` inside
`plugin-tree/src/ObjectTree.tsx`. The live host is the console: it stores view records
and passes them as `views`, and its create-view dialog offers `tree`. So a real
consumer wrote this block with no type to write it against, and a misspelled
`parentFeild` was admitted by the views entry's `[key: string]: any`, stored, read by
nobody and reported by nothing. Declared ≠ enforced on a surface a non-author
re-writes.

**The grades, and why.**

- `@object-ui/types` — **minor**: one new name, `TreeViewConfig`, becomes reachable
  from the package entry. Nothing existing is renamed, retyped or removed, and no
  value's validation changes anywhere in this package.
- `@object-ui/plugin-view` — **minor**: `ObjectViewProps.views[n].tree` is now
  declared `TreeViewConfig` where it previously resolved to `any` through the entry's
  index signature. On a face that already admitted every spelling a declaration
  **cannot widen — it can only narrow**, and this one does: a host composing the entry
  as an object literal now gets `parentFeild` reported as an excess property instead
  of silently dropped. The index signature itself is untouched, so every other
  undeclared key a host puts on the entry still type-checks exactly as before.
- `@object-ui/plugin-tree` — **patch**: the module-local interface becomes an import
  of the exported one and the resolver's own type is `Pick`ed off it. No runtime
  behaviour changes, and no key is added to or removed from what the renderer reads.

**`titleField` is declared, not deleted — and that was a measurement.** The ruling put
this key to a test: declare it if the console writes it, else remove the read. The
console's create-view dialog does **not** offer it (its `tree` slot collects
`parentField` alone), but the console's own host composition reads it by name, so do
the `ListView` and `ObjectView` tree branches, and the rung is pinned as live behaviour
by objectui#6557 ("the tree's second view-declared rung … still answers"). Deleting the
read would have reversed a recorded ruling and reddened its pin. Declaring it makes
declared = enforced at all four read sites at once. `labelField` remains canonical and
wins wherever both are present.

**Migration.** None required. Hosts that already compose a `tree` block keep working;
hosts that annotate one against `TreeViewConfig` start getting a compile error for a
misspelled key instead of a view that silently ignores it.

⛔ This does not make `tree` an authorable view type. objectui#5321 is untouched: the
block is host config, written by a host and never by a document author, and the
authored node remains the flat `ObjectTreeSchema`.
