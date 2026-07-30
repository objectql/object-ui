---
"@object-ui/data-objectstack": patch
---

fix(data-objectstack): a view's own filter no longer disappears when the user adds one

`ObjectStackAdapter` translated object-form filter entries
(`[{ field, operator, value }, ...]`) only at the **top level** of a `$filter`.
The moment a list has both a stored view filter and a user filter, it builds

```js
['and', [{ field: 'stage', operator: 'eq', value: 'won' }], [['amount', '>', 1]]]
```

whose head is the string `and`, so the old check called the whole thing
"already AST" and shipped the rules untranslated. Both server answers to that
are wrong:

```js
isFilterAST(above)    // false — a bare rule object is not an AST child
parseFilterAST(above) // { amount: { $gt: 1 } }   ← `stage = won` is GONE
```

Since objectstack#4121 the `isFilterAST` gate turns it into a **400 and the
list fails to load**. Before it — or anywhere `parseFilterAST` is reached
without that gate — **the view's own condition is dropped without a word** and
the list returns records the view exists to exclude.

Translation is now recursive through `and`/`or` nodes and legacy flat child
arrays, so the shape reaches the server as a valid AST
(`{$and: [{stage: 'won'}, {amount: {$gt: 1}}]}`).

Three related fixes in the same code:

- **An untranslatable entry is now an error, not an omission.** Entries that
  failed to translate were dropped, and dropping one conjunct of an `and`
  returns a *superset* of the rows asked for — dropping the last one sent no
  `filter=` at all, so the whole table came back. `find()` now throws
  `MalformedFilterError`, carrying `code: 'INVALID_FILTER'` / `httpStatus: 400`
  so a failed list renders "the filter is malformed" rather than "check your
  connection". A rule with a blank `field` passes `ViewFilterRuleSchema`
  (`z.string()` admits `''`), so this is reachable from real stored metadata.
  A *mixed* array (`[{ field, operator, value }, ['amount', '>', 1]]`) now
  keeps both halves instead of dropping the tuple — that case was a lost
  condition, not a malformed one.
- **The two `find()` routes can no longer disagree.** The "is this object
  form?" test existed twice — once in `translateFilterToAST`, once inline in
  `convertQueryParams` — and the copies had already drifted: the inline one
  omitted a `!== null` guard, so a `$filter` of `[null]` threw a `TypeError` on
  the plain route while the same value was handled on the `$expand` route. One
  definition now serves both.
- **Dropped an unreachable `entry.name` fallback.** `objectFilterEntryToAST`
  read `entry.field ?? entry.name` while the shape check keyed on `field`
  alone, so the `name` half was dead from the commit that introduced it. The
  spec agrees it is not a real shape — `ViewFilterRuleSchema.field` is
  required, so such a rule cannot be saved as view metadata.

Refs objectstack#3948, objectstack#4121, #2945
