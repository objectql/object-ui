---
'@object-ui/types': patch
---

The three view handler keys are declared as EVENT NAMES, not callbacks.

`ViewSwitcherSchema.onViewChange`, `FilterUISchema.onChange` and
`SortUISchema.onChange` were described as "change callback" on both the zod
mirror and the TS interface. They are not callbacks: the string an author
writes is the NAME of a `CustomEvent` the renderer dispatches on `window` —
`new CustomEvent(schema.onViewChange, { detail: { view } })` and its two
siblings.

**What an author feels.** Nothing they write breaks — the type is still
`string`, so no accept set moves and no existing document changes verdict.
What changes is that the declaration, the generated JSON Schema description and
the TS JSDoc now tell them what the string is FOR, and what to listen for:

```json
{ "type": "sort-ui", "fields": [{ "field": "name" }], "onChange": "myapp:sort-changed" }
```

```js
window.addEventListener('myapp:sort-changed', (e) => e.detail.sort);
```

Previously "Sort change callback" invited the two readings the runtime does not
support — a function (unwritable in JSON) or a handler expression (dropped at
runtime) — with no hint that the working form is an event name.

The correction also protects the capability. A handler-key census that buckets
by declared TYPE cannot tell an event name from the unsupported
handler-expression dialect, and on that reading these three had been swept in
for retirement, which would have deleted working behaviour. A new pin
(`plugin-view/src/__tests__/handlerEventNameLiveness.6124.test.tsx`) now holds
both halves — that each key is DECLARED on the authorable surface, and that the
authored string reaches `new CustomEvent(...)`.
