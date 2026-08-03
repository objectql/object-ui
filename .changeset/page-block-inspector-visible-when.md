---
"@object-ui/app-shell": patch
---

The Page block inspector's conditional-visibility control now authors
`visibleWhen`, and says "Visible when" while doing it (objectui#3229).

FROM: the `ConditionBuilder` rendered for the selected page block read and wrote
`block.hidden`. TO: it reads and writes `block.visibleWhen`, the canonical
conditional-visibility key (ADR-0089), through the same envelope read/write pair
the hook and action guards use (objectui#3218).

`PageComponentSchema` (`ui/page.zod.ts`) is `.strict()` and has no `hidden` key
at all. So this was not a tolerant consumer accepting something sloppy — it was
the **producer emitting a key the contract rejects**: every author who filled
that box got a save-time parse failure naming a key they never typed, because the
inspector typed it for them. The spec's own error message already names the fix
(`` the canonical key is `visibleWhen` ``). A designer that mass-produces drafts
guaranteed to be rejected is a worse failure than a lenient reader — a lenient
reader lets wrong metadata run, this made the *correct tool* emit the wrong thing.

The fix also closes the gap in the other direction: a **valid** block carrying
`visibleWhen` previously had no control in the inspector that could edit its
visibility, because the only visibility control on screen wrote a different key.
Removing the control instead would have stopped teaching the wrong key but left
that gap open, which is a capability regression.

**The semantic flip lands in the UI copy, not just the key.** `hidden` and
`visibleWhen` are inverses (`hidden` true ⇒ gone; `visibleWhen` true ⇒ shown), so
the label, the i18n key (`engine.inspector.pageBlock.hidden` →
`engine.inspector.pageBlock.visibleWhen`) and both language packs move together:
"Hidden (CEL)" → "Visible when (CEL)", 「隐藏条件（CEL）」→「显示条件（CEL）」.
Renaming the key while leaving hide-flavoured copy would have been worse than
leaving the bug: authors would write the predicate backwards, producing metadata
that PARSES and means the opposite — the objectui#3276 class, which objectui#3257's
guard is structurally blind to because it only asks whether a draft parses.

**No value is migrated.** An existing `hidden` expression is NOT negated into
`visibleWhen`: textually negating an arbitrary CEL predicate is unsound
(`!(a && b)` is not `!a && !b`), and there is no stored valid draft to migrate
anyway — since ADR-0089 D3a `hidden` is a loud parse failure on save, and before
D3a the key was silently dropped, so it never reached published metadata either.
A loud error on a rare stale draft, with the spec's message pointing at
`visibleWhen`, beats silently rewriting an author's predicate.

Because `visibleWhen` is `ExpressionInputSchema`, a persisted block carries the
`{ dialect, source }` envelope rather than the authored string, so the control
goes through `expressionSource` / `writeExpressionSource` — an edit preserves
`dialect` and `meta` and drops the stale `ast`, instead of flattening the
envelope to a bare string and silently swapping the evaluation engine.

Tests pin DIRECTION, not just the key name (the objectui#3276 precedent makes
that a hard requirement): the block the inspector actually commits is rendered
through `SchemaRenderer` and must appear when its predicate is true and be absent
when it is false, alongside assertions that the committed key is `visibleWhen`,
never `hidden`, and that the resulting draft parses.
