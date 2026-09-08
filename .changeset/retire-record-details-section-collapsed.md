---
'@object-ui/types': minor
---

**BREAKING** — `RecordDetailsComponentProps.sections[]` no longer declares `collapsed`.

**FROM** `collapsed` **TO** `defaultCollapsed`.

```ts
// before
sections: [{ label: 'Address', fields: ['street', 'city'], collapsed: true }]
// after
sections: [{ label: 'Address', fields: ['street', 'city'], defaultCollapsed: true }]
```

`@objectstack/spec` `RecordDetailsProps.sections[]` refuses `collapsed` by name
(`unrecognized_keys`), and `defaultCollapsed` is the spelling it declares for that
state — the spelling `DetailSection` has always read. So the retired key never
reached the renderer through a spec parse, and nothing in this repository read it:
this is a type-face narrowing, not a data or runtime change. There is nothing to
migrate — rename the key at the authoring site.

`collapsible` is unaffected; it stays.

⚠️ The census behind this removal covers this repository only. A TypeScript
consumer of `@object-ui/types` outside it that wrote `collapsed` is not
observable from here, and gets a compile error (TS2353) naming the key — which
is why the FROM/TO is spelled out above.

Retires the last member of the divergence objectui#8583 measured. The six keys
this type used to omit are item 1 of the same card; its changeset is still
pending, so both halves ship in this release.
