---
'@object-ui/app-shell': patch
---

The metadata Audit panel's lock column now shows Chinese for every lock state it can print.

`AuditPanel` renders `MetadataAuditEntry.lockState` through
`translateConsoleValue('lock', …)`, but `CONSOLE_VALUE_ZH.lock` held
`draft` / `locked` / `published` / `none` — a draft-status vocabulary, not the
ADR-0010 §3.6 four-state lock. The misalignment was total rather than partial
(objectui#5004): `draft` / `locked` / `published` matched no value `lockState`
can hold; `none`, the only entry that did match, is excluded by the call site's
own guard (an unlocked row renders an em dash) and so was unreachable; and the
three values that actually reach the helper — `no-overlay` / `no-delete` /
`full` — had no entry at all. Hit rate 0/3. A zh-CN admin opening any locked
item's Audit panel read bare English tokens in a column headed 锁状态.

The table is now the lock vocabulary it claims to be — `禁止编辑` / `禁止删除` /
`完全锁定`, wording tracked to the lock-banner sentences a reader meets on the
same screen — and the three draft-status entries are gone. They were dead in the
measured sense: `translateConsoleValue('lock', …)` has exactly one call site
repo-wide and `CONSOLE_VALUE_ZH` is module-private, so nothing else could read
them.

Following objectui#4982's `LAYER_SCOPE_ZH`, the keys are bound to their
producer's union — `Record< NonNullable< MetadataAuditEntry['lockState'] >,
string >`. A fifth lock state therefore fails `type-check` naming the label that
is missing, instead of the column silently shipping a raw English value. The
union is this repo's own hand-written one in `@object-ui/data-objectstack`, not a
`@objectstack/spec` enum; whether the spec should own the lock vocabulary is a
separate question and is deliberately not answered here.

`none` is kept in the record even though the call site never asks for it, so the
key set stays complete over the producer's type rather than tracking a `!==`
guard in another file. Unchanged on purpose: `translateConsoleValue` is still
zh-only, and the em-dash branch for `none` / `null` still renders exactly as
before.
