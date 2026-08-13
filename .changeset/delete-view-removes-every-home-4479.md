---
'@object-ui/data-objectstack': minor
---

`deleteView` removes every home the view has — deleting a draft-only saved view no longer silently no-ops

A view has two possible homes: the pending per-item **draft** (`DELETE /api/v1/meta/view/:name?state=draft`) and the **published** overlay (`DELETE /api/v1/meta/view/:name`). `deleteView` addressed only the second, unqualified. Deleting a view that existed only as a draft therefore fired the delete at the published overlay, the server answered `200 {"success":true,"reset":false,"message":"No view '…' found — nothing to delete."}`, the draft survived untouched, and the tab was still there after a reload — while the receipt reported `{ deleted: false }` and nothing surfaced the refusal to the user.

That is not a corner case. ADR-0034's `persistRuntimeMetadata` (app-shell) stages **every** runtime edit as a draft, and a view created from the `+` tab lives ONLY as a draft until an explicit Publish — so both "a view you just made" and "a published view you have since edited" are routinely draft-carrying.

**Why this is not the mechanical mirror of #4139.** `updateView` probes the draft first and writes back to whichever home the read resolved; that is right for an update in all cases. Copying it here would have been wrong in one: on a published+draft pair a draft-first-*only* delete discards the draft and leaves the published row still serving the view. That is not Delete view, it is **Discard draft** — a deliberately different operation that already exists (`discardRuntimeDraft`, documented as "the published overlay is untouched"). The asymmetry has a clean statement: for an update, one home is the right home; for a delete, "remove this view" is satisfied only when *no home is left serving it*.

So both homes are now deleted, **draft first**. The order is load-bearing on the failure path: a fault between the two calls leaves the published overlay intact, so the view is still served and the delete is cleanly retryable. The reverse order would strand a draft-only view — precisely the bug above.

**Two blind calls, no probe.** Measured against the framework's `deleteMetaItem`: a missing home is reported as a **200** carrying `reset:false` (`"No pending draft for view/x."` / `"No view 'x' found — nothing to delete."`), never a 404. There is nothing for a probe to protect against, and `updateView`'s probe exists for a different reason — its read must resolve the row the merge writes back to — which has no counterpart for a delete.

**One transport, one error contract.** Both halves now go through `MetadataClient.reset()`, the transport that can express the `?state=` qualifier and the one `updateView`'s draft half already uses. The published half previously went through `client.meta.deleteItem`; measured, that issues the byte-identical request (this adapter configures no environment scoping), so routing it here changes no addressing and collapses two error shapes into one `MetadataError`.

The receipt is widened **additively**: `{ deleted }` gains optional `draft` and `published` outcomes (`removed`, plus the server's `reset` / `message`). `deleted` is true only when no home is left serving the view *and* at least one actually held a row — a view that existed in neither home still answers `false`, unchanged. A failure of the published half after the draft was discarded now throws (matching `updateView`'s convention of surfacing a fault rather than degrading) carrying the partial state on the error's `outcome`: "draft gone, overlay left" is exactly what the old `{ deleted: boolean }` could not express, and it is never rounded up to `true`.

Cache invalidation moves into a `finally`, so `invalidateViewKeys` fires exactly once per call on **every** outcome including the throw. After a half-failure the draft row really is gone, and objectui#4363's asymmetry decides it: an unnecessary invalidation costs one refetch, a missed one costs the cache's full 5-minute TTL of stale overrides.

Minor rather than patch: this moves published behavior for existing callers and adds two exported types, the same grading objectui#4271's `get()` unwrap and objectui#4495's `find()` resolve→reject took. The `.d.ts` diff is additive only — `deleteView`'s return widens from an inline `{ deleted: boolean }` to the new `DeleteViewResult`, which still carries `deleted: boolean` — so no consumer needs a code edit to keep compiling. A repo-wide census found one call site (app-shell's `ObjectView` delete handler), which awaits the call and does not read the receipt.
