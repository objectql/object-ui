---
'@object-ui/components': patch
---

`element:button`'s action forward is excess-property checked again — a misspelled key on that payload is now a compile error, not silence

The payload `element:button` hands to `execute(…)` closed with `as any`. An assertion asks only for comparability, so it switched TypeScript's excess-property (freshness) check off for the whole literal: all sixteen keys the renderer forwards rode unchecked, and `ActionDef` being a closed type (objectui#4046) bought this surface nothing. A typo added to that list — `refreshAftr`, `confirmTxt` — would have compiled, published, and reached a runner that silently does nothing, which is the objectstack#2169 "Mark Done does nothing" shape the closed type exists to prevent.

The exemption that recorded this assumed the cast was load-bearing, on the reasoning that `element:button` receives a bare `action?: Record< string, any >` prop rather than a typed action, so removing the cast would be a contract change. Measured on TypeScript 6.0.3, that was wrong on the point that mattered: dropping the cast type-checks clean as-is, because every key the literal writes is already declared on `ActionDef`. The prop's type is a separate question and is deliberately untouched here — the forward literal never needed the cast to compile.

Two literals needed it, not one. The `execute(…)` argument is contextually typed by `execute(action: ActionDef)`, so dropping the cast is enough for the explicit keys. The `paramsPayload` binding spread into it is the second, easily-missed half: a spread source's own keys are not checked *through* the spread, so `{ actionParams }` / `{ params }` could still invent a key while the payload around them was checked. That binding is now annotated `ActionDef` too.

Runtime behaviour is unchanged — the object reaching `execute` is identical, key order included, and the emitted `.d.ts` does not move. What changes is that the compiler now rejects an invented key here, verified in both directions: the same probe key produces `TS2353` after this change and no diagnostic at all before it.

With this surface fixed, `check:action-forward-parity` has no payloads exempt from its freshness rule: all five action-forwarding renderers write into a literal the compiler checks, and the gate's ratchet removed the exemption entry itself as designed.
