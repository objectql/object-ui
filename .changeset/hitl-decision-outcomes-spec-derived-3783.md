---
"@object-ui/plugin-chatbot": minor
---

`ApproveOutcome` / `RejectOutcome` are now derived from `@objectstack/spec`
instead of hand-transcribed (objectui#3783). Same failure class #3220 cleared
from the same file for `PendingActionRow` / `PendingActionStatus` — but this pair
wore local names rather than spec names, so `check-spec-symbol-derivation.mjs`,
which fires on a spec export name being occupied, had no handle on it. A renamed
hand copy is invisible to a name-based guard by construction.

Both types now re-export the spec's decision responses
(`ApproveAiPendingActionResponse` / `RejectAiPendingActionResponse` from
`@objectstack/spec/api` — the same schemas `@objectstack/client`'s
`ai.pendingActions.approve()` / `.reject()` type their returns with). The public
export names do not change. The shapes do, in three ways:

- **`ApproveOutcome` no longer declares `id`.** The approve response has never
  carried one — `id` is on the *reject* response. This was the one drift that
  was not dormant: `useHitlInChat`'s public `onDecided` callback promised
  consumers `id: string` and handed them `undefined` at runtime, with nothing
  in the compiler to say so. **If you read `outcome.id` after an approve, that
  read was already `undefined` and now fails to compile** — take the id from
  `ContinueContext.pendingActionId` or from the row you decided on.
- **`status` is closed.** `'executed' | 'failed' | string` and
  `'rejected' | string` were both just `string`: a union with `string` absorbs
  the literals, so neither annotation carried any information. They are now
  `'executed' | 'failed'` and `'rejected'`.
- **The `[k: string]: unknown` index signature on `ApproveOutcome` is gone.** The
  objectstack#4075 mechanism: with it, any structural comparison against the
  spec answers "identical" however far the copy has drifted, so a parity test
  bolted onto the old type would have been green from its first day.

**Breaking at the type level for importers of `@object-ui/plugin-chatbot`** —
narrowing a published type is a break even when the old type was lying, which is
why it is spelled out here. Shipped as `minor` per AGENTS.md §版本号策略: the
family's `major` tracks `@objectstack`'s, and objectui's own breaking changes go
out as `minor` with the break named in the changeset.

Runtime behaviour is unchanged — including the hook's decision handling for a
status outside the spec vocabulary, and the locally synthesized failure envelope
on a non-2xx, both now pinned by tests. The consumer-side tolerances that remain
in `useHitlInChat` are recorded in objectui#3790 for a maintainer decision.
