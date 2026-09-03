---
'@object-ui/components': minor
---

**Renamed:** the declared input carrying the action's execution type on `action:button` and
`action:icon` is now `actionType`. It used to be `type`, which collides with the SDUI
envelope's component discriminator. **No alias and no transition window** — a declaration
still spelling it `type` sets the discriminator, not the input.

Implements objectstack#14490 ruling A (maintainer, 2026-09-02, decision batch #13 item 4,
verbatim 「同意」). The objectui half; the pinned `sdui.manifest.json` in objectstack follows
as a separate change.

**Why the old name could not stay.** `action:button` and `action:icon` were the only two of
the manifest's 57 components declaring an input named `type`, and on no tier could an author
actually set it:

- **html tier** — `parse.ts` composes a node as `{ type: tag, ...props }`, props spread
  last, so `type="api"` replaced the component discriminator and the node stopped resolving
  to a component at all. `validate.ts` cannot report that: `type` is in `BASE_PROPS`, so it
  is skipped before the declared-input check runs. Two mechanisms, one outcome, no
  diagnostic. objectstack PR #14274 landed a refusal on this tier whose prescription
  ("write the tag you meant") is wrong for exactly these two components.
- **react-page tier** — the wrapper stamps `type: tag` last and parks the author's value
  under `specType` (objectui#2880), which neither action renderer reads.
- **JSON / `SchemaRenderer`** — the node's `type` is the component id, and the renderer
  forwarded it to `ActionRunner` as the action type. `'action:button'` binds no handler and
  no builtin: the click did nothing, with no error and no toast (the objectui#6306 shape).

`actionType` is not a new vocabulary. It is the spelling this repo already used for this
exact value: `action:bar` renames the declared type as it spreads a member onto its child
(`type: componentType, actionType: action.type`), `ActionRunner.execute` resolves
`action.type || action.actionType || action.name`, and both renderers already read
`schema.actionType` FIRST. The rename makes the one working spelling the declared one.
It follows the resolution `page:tabs.type` got upstream for the same carrier collision
(retired in favour of `tabStyle`, objectstack#6776) rather than inventing a new convention.

**Census of the authored corpus, measured before the rename, not assumed.** Across 4,797
files in `examples/`, `apps/console/`, `content/docs/` and `packages/`: **zero** authored
nodes set the input. 517 JSON files (433 of them the schema catalog) contain 2,410
`type`-bearing nodes and **no** `action:button` / `action:icon` node at all — control: 127
plain `button` nodes on the same walk. 207 parsed fenced JSON blocks in md/mdx carry **5**
`action:button` nodes, all of them `{ type, label, icon?, action }` — the discriminator plus
the `action` channel, none setting an execution type — control: 28 plain `button` nodes, and
the count independently matches the corpus census already recorded in `SchemaRenderer.tsx`
("`action:button` (5 nodes)"). No docs page documents the input; no catalog entry uses the
components. So the rename breaks no authored document in this repo.

**What changes for a consumer.** The renderers no longer fall back to `schema.type` when
`actionType` is absent — that fallback is the old spelling, and the ruling forbids an alias.
A node that declares neither now forwards `type: undefined`, and `ActionRunner` falls
through to its own `action.name` leg instead of being handed a component id. Declarations
composed by `action:bar`, `action:group` and `action:menu` are unaffected: they carry the
spec `ActionSchema.type` inside an `actions` array, which is a different surface and is
unchanged.

Pinned by `action-type-input-html-tier.test.tsx` (the html tier authors the renamed input
end to end; the manifest built from the live registry accepts `actionType` and reports a
bogus prop as the control) and by the rewritten standalone rows in
`action-bar-member-type-resolution.test.tsx`, one of which now fails if the `|| schema.type`
leg is ever added back.
