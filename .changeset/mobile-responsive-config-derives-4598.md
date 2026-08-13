---
'@object-ui/mobile': patch
---

`SpecResponsiveConfig` is now the spec's responsive config rather than a hand copy that said it was

`useResponsiveConfig.ts` declared its own interface over the four responsive keys — `breakpoint`, `hiddenOn`, `columns`, `order` — renamed off the schema's own symbol (`ResponsiveConfig` → `SpecResponsiveConfig`) and introduced by a comment that said it mirrored `ResponsiveConfigSchema`. There was no import, no `z.infer`, and no other compile-time tie: the sentence was the entire connection.

It agreed with the schema key-for-key on the day it was measured, and that is the reason this is worth a line rather than the reason it is not. The agreement was maintained by nobody and checked by nothing, while the comment told every later reader the copy was canonical — so a key added or retired upstream would have moved the two apart in silence, with the comment still vouching for the copy. `ViewNavigationConfig` read exactly like this until it had drifted on `mode`.

The type is now re-exported from `@object-ui/types`, which publishes it imported straight from `@objectstack/spec/ui`. That package is already this one's only runtime dependency, so the binding costs no new dependency edge, and `@object-ui/core`'s `ResponsiveProtocol` already reaches the same type the same way.

Nothing consumers see changes: the published name is the same, and the type it resolves to is invariant-equal to the interface that was there before — the entry `.d.ts` is byte-identical. What changes is where the four keys come from. They are now whatever the schema declares, so the next schema release reaches this package's authors as a type error instead of as silent disagreement.

A new parity test pins the chain to `@objectstack/spec/ui` directly, because the one link the re-export cannot see is `@object-ui/types` re-growing a hand copy of its own.
