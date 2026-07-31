---
"@object-ui/core": patch
"@object-ui/data-objectstack": patch
"@object-ui/plugin-list": patch
"@object-ui/plugin-view": patch
---

fix(view,list,core): a view's filter no longer disappears, or arrives as a predicate on columns that don't exist

Sweeping the other `$filter` producers after #3078 turned up two live defects in
`ObjectView`, which fetches its own data for calendar / kanban / gallery /
timeline (grid delegates to `ObjectGrid`).

**1. An object filter was dropped, and only for non-grid views.**
`table.defaultFilters` is declared `Record<string, any>`, and the merge tested
`baseFilter.length > 0` — `undefined > 0` for an object. So the filter vanished
and the view returned **every record**. `ObjectGrid` assigns the same value
straight to `params.$filter`, so one view definition filtered correctly as a
grid and returned everything as a calendar.

**2. Rule objects were spread into the `and`, not wrapped.**
`['and', ...baseFilter, ...userFilter]` is only correct when the source is an
array of AST nodes. `activeView.filter` is a spec `ViewFilterRule[]`, so
spreading put bare rule objects where the AST expects nodes:

```js
isFilterAST(['and', {field:'stage',operator:'eq',value:'won'}, ['owner','=','me']])
// false → 400 since objectstack#4121
parseFilterAST(same)
// {$and:[{field:'stage',operator:'eq',value:'won'}, {owner:'me'}]}
```

That second line is a predicate over three columns named `field`, `operator`
and `value` — which don't exist. Reachable whenever a view with a filter meets a
user filter value.

New in `@object-ui/core`: `toFilterNode` normalizes one source (rule array / AST
/ MongoDB object) and `mergeFilterNodes` combines sources as siblings under one
`and`. `ObjectView` and `ListView.buildEffectiveFilter` both use them, so the
three filter shapes are reconciled in one place instead of by hand at each
renderer.

`ObjectStackAdapter` also now translates a bare rule object sitting directly
under a logical node — the chokepoint defence for any producer still emitting
the spread shape. Only rule-*shaped* objects are touched; a child with no
`field` is a genuine MongoDB condition and passes through untouched.

**Correcting a comment shipped in #3078.** `buildEffectiveFilter` documented the
dropped-object case as unreachable, "nothing in this repo produces one for a
list view". That was wrong: `ObjectView` passes `mergedFilters` straight into
that schema's `filter`, and its last fallback is `table.defaultFilters`. The
case is now handled rather than explained away.

Verified with 19 tests across the four packages; reverting each source file
fails the ones that cover it. Emitted filters are asserted against the spec's
own `isFilterAST` / `parseFilterAST`, including an executable pin on what the
old spread shape produced.
