---
'@object-ui/app-shell': patch
---

Fix the page designer's `page:tabs` item control, which wrote a key the spec
refuses by name and the tabs renderer never reads (objectui#8278).

**Every tab strip built in the page designer carried no stable per-tab value.**
`BLOCK_CONFIG['page:tabs']` named its identifier item control `key`;
`PageBlockInspector` writes an item key verbatim (`next[i] = { ...itemObj, [n]: v }`),
so an author who filled that box produced `properties.items[i].key`. Three faces
disagreed with that spelling, all three measured on `@objectstack/spec@17.3.0`:

- `ComponentPropsMap['page:tabs'].safeParse` returns `success: false` with
  `unrecognized_keys` naming `key` at `items.0` — and 17.3.0's own message now
  spells the remedy out, "Did you mean `key` -> `value`?";
- `PageTabsRenderer` builds `itemsWithValue` from `it.value` and reads `it.key`
  nowhere, so the tab falls back to the index-derived `tab-IDX`;
- `PageTabsProps.items[].value` is a real, declared schema member, which this
  repo's own `block-config.test.ts` already stated in prose.

So every designer-built tab was addressed by INDEX — exactly the failure
objectui#2257 dealt with for the URL-addressable active tab (`?tab=`): the deep
link silently points at a different tab as soon as the item list changes. The
author DID supply a stable identifier; it landed under a key nothing reads, and
nothing reported it (`PageComponent.properties` is an open bag, so the page parse
stays green).

The control is renamed to `value` on the producer side — AGENTS.md #0.1 and the
rule stated in `block-config.ts`'s own file header ("keep each field `name`
aligned with the property name the corresponding renderer reads"). Teaching the
renderer a second spelling would have been the lenient-fallback shape that rule
forbids. The field `name` is the last segment of the i18n key, so both locale
tables move with it in this one commit and the retired key leaves both, the
objectui#3829 / objectui#5212 pattern.

objectui#8216's parity gate carried this key as a LEDGER row. That row is
deleted here: the gate is a two-way ratchet, and a resolved key that leaves its
row behind is as red as an unledgered violation.

**Stored documents are left as they are, deliberately.** A tab strip saved by a
released build carries `items[].key`, which was unread before this change and is
unread after it — it already fell back to `tab-IDX`, so nothing regresses, and a
newly-authored strip is now correct. It is not carried over into `value` either:
that would be a permanent second spelling with no retirement path. It is not
stripped either, and that half is a real gap rather than a decision this change
could make — `RETIRED_BLOCK_PROP_KEYS` is a `Record<blockType, string[]>` of
TOP-LEVEL keys, so a nested `items[].key` cannot be expressed in it at all.
Tracked separately; see the follow-up card referenced from objectui#8278.
