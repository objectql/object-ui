---
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
---

Publish the five `@objectstack/spec` 17.0.0 keys the renderers already honoured, so
authors can discover them

`page:header.maxVisible`, `page:header.mobileMaxVisible`, `page:tabs.alwaysShowStrip`,
`record:details.inlineEdit` and `record:details.showHeader` are declared by the spec and
read by the renderers today, and none of them was in its block's published `inputs`. That
is the direction nothing reports: `gen-manifest.ts` left all five out of
`sdui.manifest.json` and `sdui-intrinsics.d.ts`, so they were in no designer panel and no
generated type; `sdui-parser`'s prop walk reported `unknown-prop` on an author who wrote
one anyway; and the renderer honoured it regardless. Measured on the console's own
manifest before this change, all five drew

```
unknown-prop: page:header has no prop "maxVisible"
unknown-prop: page:header has no prop "mobileMaxVisible"
unknown-prop: page:tabs has no prop "alwaysShowStrip"
unknown-prop: record:details has no prop "inlineEdit"
unknown-prop: record:details has no prop "showHeader"
```

and now draw nothing. Same defect as `record:details.hideFields` in objectui#3808 and
`readonly` in objectui#3407; it could not land until the GA pin moved (objectui#4636),
because the pre-GA pin declared none of the five and publishing them would have failed the
repo-wide parity gate's forward direction.

Each entry carries a description, because for these keys the discoverability IS the fix.
Two are worth reading before use:

- `maxVisible` / `mobileMaxVisible` are positive integers — the contract rejects `0` and
  fractional values — and they do not govern every action: an action declaring
  `record_more` without `record_header`, and any action with `component: 'action:menu'`,
  is routed to the overflow menu regardless of the budget.
- `inlineEdit` is an opt-OUT only. The value is combined with the object's own resolved
  editability (ADR-0103) and with the server's effective API operation set, so `false`
  always wins while `true` cannot open editing the platform refuses.

**`page:tabs` also gains a read.** `alwaysShowStrip` was honoured only as
`schema.properties.alwaysShowStrip`, while `inputs` publishes TOP-LEVEL keys — the shape
the manifest whitelists, the generated types declare and the JSX-page compiler validates.
Measured on a one-tab schema: the wrapped form showed the strip, the flat form did not, so
publishing the key alone would have advertised a write the renderer throws away. The
canonical top-level arm is read first now, with the `properties` arm kept for paths that
reach the renderer without `SchemaRenderer`'s hoist — the same dual read `maxVisible` has
always had. This can only ever ADD a strip to a one-tab page; multi-tab pages are
unaffected, and `false` and non-boolean values both read as "not set".

The five GA-pending entries that held this card's place in
`registry-inputs-spec-parity.test.ts` are deleted, which is what the gate's own
`carries no stale unpublished-key exemption` check demands once the keys are published.
