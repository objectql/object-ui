---
'@object-ui/core': minor
'@object-ui/types': minor
'@object-ui/components': patch
---

BREAKING (`@object-ui/core`): `ActionRunner`'s legacy `ActionDef.onSuccess`
chained-callback channel is retired — `onSuccess` now has exactly the meaning the
contract declares (objectui#5934, maintainer ruling 2026-08-31).

(The bump is `minor` by this repo's release model — objectui's major is pinned to
the `@objectstack` family major, and its own breaking changes ship as `minor` with
the break spelled out here, per `scripts/check-changeset-no-major.mjs`. This
paragraph is that spelling-out: the break below is real and consumer-visible.)

- **What breaks, by specifier**: `import type { ActionDef } from '@object-ui/core'` —
  `ActionDef['onSuccess']` was `ActionDef | ActionDef[]` (chained callbacks the runner
  dispatched through `executeChain` after a success). It is now derived from the pinned
  spec: `ActionSchema.onSuccess`'s closed strict `{ navigate: string, openIn?: 'self' |
  'newTab' }` block. Code that assigned a callback `ActionDef` (or an array of them) to
  `onSuccess` no longer compiles, and at runtime a callback-shaped value gets NO reading —
  no handler dispatch, no navigation, the action's own result untouched. `onFailure` is NOT
  changed: the spec declares no such key, so it keeps its one runner-native meaning.
- **Why this is safe to take**: the channel was unreachable from validated metadata —
  `@objectstack/spec` (17.2.0 pin) strict-refuses a callback shape inside `onSuccess` at
  parse (`invalid_type` on `navigate` + `unrecognized_keys`), so no published/saved
  metadata could ever carry one — and a producer census with a positive control found zero
  producers outside the channel's own test pins. Migration for an out-of-repo consumer that
  drove the channel programmatically: put the follow-up actions in `chain` (the runner's
  declared chaining key, unchanged), or author the spec's `onSuccess` navigation block.
- `@object-ui/types` (minor): `UIActionSchema` now declares `onSuccess`, derived from the
  spec's `ActionSchema.onSuccess` — the renderer view spells the key the four action
  surfaces forward, so the forwards type-check.
- `@object-ui/components` (patch): the four action renderers forward `onSuccess` without
  the `as any` casts (no behavior change — same key, same value, now typed).
