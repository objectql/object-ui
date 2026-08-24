---
'@object-ui/types': minor
'@object-ui/components': minor
---

**BREAKING (authoring): `ui:icon` names its glyph with `icon`, not `name`**

`{ "type": "icon", "name": "check" }` no longer renders an icon. Write
`{ "type": "icon", "icon": "check" }`. Stored metadata authored before this
release needs converting — see the migration below.

Marked `minor` per AGENTS.md §版本号策略 (this repo never publishes `major`
outside an `@objectstack` major sync); the break is real and is stated here.

**Why**

`name` is the SDUI identity key every authored node carries, alongside `id` —
it is not `ui:icon`'s private prop. So an ordinary node like
`{ type: 'icon', id: 'save_icon', name: 'save_icon' }` asked lucide for a glyph
called `SaveIcon`, missed, and rendered **nothing at all**: silent to a human,
and clean to a DOM gate, because a renderer that renders nothing spreads no
attributes to find. `action:*` already reads `icon`, so this is the vocabulary's
existing answer, and it leaves no node type on which the identity key is
unusable.

**What changed**

- `IconSchema` (types + its zod mirror) declares `icon: string` **required**,
  exactly as `name` was required before it — a key rename at constant
  strictness. `name` reverts to the optional identity inherited from
  `BaseSchema`. The mirror previously *required* `name`, which is why the
  renderer could not be migrated on its own: the published contract refused the
  correct shape.
- `ui:icon` resolves its glyph from `schema.icon`. There is deliberately **no**
  `icon ?? name` fallback: a key meaning "identity" or "glyph" depending on
  whether a lucide lookup happened to hit is the ambiguity being removed.
- The registry's `inputs` entry and `content/docs/components/basic/icon.mdx`
  moved in the same change as the resolver.
- All 98 authored icon nodes in this repo are converted.

**The break is loud in three places, never silent**

1. `IconSchema` **refuses** a legacy node, with a message that names the rename
   and points at the converter — not zod's default `expected string, received
   undefined`.
2. A legacy node that reaches the renderer unvalidated draws the visible
   placeholder shipped in the previous release, and its `console.warn` now
   carries the exact rename (`icon: "save_icon"`) plus the converter's name.
   Its accessible name says so too, and it gains a
   `data-objectui-icon-legacy-name-key` marker so a gate can tell
   "unmigrated node" from "glyph that does not resolve".
3. **Migration for stored metadata** — `migrateIconNodeKeys` from
   `@object-ui/types`:

   ```ts
   import { migrateIconNodeKeys } from '@object-ui/types';

   const { document, converted, warnings } = migrateIconNodeKeys(storedPage);
   if (warnings.length) console.warn(warnings.map((w) => w.message).join('\n'));
   if (document !== storedPage) await save(document);
   ```

   It walks the whole document and lifts `name` to `icon` on every icon node.
   It is a one-shot conversion a deployer runs over stored documents — **not** a
   read-path fallback; nothing calls it during rendering or parsing. It
   **reports rather than guesses** for the two cases it will not touch: a node
   already declaring both keys (`icon` wins, `name` stays the identity it is),
   and a node naming no glyph at all.
