---
---

No published behaviour changes: the emit-side `(col as any).fitContent` cast in
`ObjectGrid`'s grouped-width pass is dismantled, and the guard that observed it is
re-pointed rather than deleted (objectui#6424, maintainer ruling 2026-08-29, option
甲).

`TableColumn` declares `fitContent` since PR #6673, so the ruling's declare branch
completes with the cast removed. ⚠️ The narrowness of what that buys is measured, not
assumed: the cast was already worth **zero** type safety, because the receiver is `any`
either way — `applyColumnChrome` is `(col: any)`, so `orderedColumns` is `any[]` and the
loop widens it a second time. The TypeScript checker reports `isAny=true` for the
receiver both before and after the cast, against a control in the same query shape that
reports a non-`any` type. Removing it changed no emit type and no rendered output.

The load-bearing half is the guard. `columnReadBoundary-6458.test.ts` used that cast as
its anti-vacuity control 3 — the one control proving its scanner can find a real cast in
the real file at real scale — and that control's own comment requires it to be re-pointed
at another real cast and never deleted. Its scanner had the receiver hard-coded to `col`,
and dismantling left the file with zero `col` casts outside the guarded region, so the
receiver becomes a parameter (defaulting to `col`, so every bound assertion is unchanged)
and the anchor moves to `(schema as any).hideRowHeightToggle`.

That anchor is chosen on a principle rather than merely moved: it is a deliberately held
non-authoring key (objectui#5091) that is independently pinned by
`gridNonAuthorKeys.test.tsx`, so it cannot expire silently the way `fitContent` just did —
retiring it turns that guard red in the same run. Control 2 gains a pair of assertions
pinning that the new receiver parameter is honoured rather than ignored, so the bound
assertions' scoping to `col` cannot quietly become a fiction.
