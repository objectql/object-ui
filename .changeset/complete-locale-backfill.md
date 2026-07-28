---
"@object-ui/i18n": patch
---

feat(i18n): complete the locale backfill — all ten packs reach full key parity (objectui#2872)

Translates the remaining **275 keys × 8 packs = 2,200 strings**, closing
objectui#2872. The largest namespaces are `grid` (101, mostly the import
wizard), `gantt` (58) and `dashboard` (25), plus a long tail across `list`,
`auth`, `fields`, `marketplace`, `capability` and nine others.

Every pack is now at parity with `en`: **2,495 of 2,499 keys**, zero keys that
`en` lacks. The four-key remainder is the outbound-message set, absent by
design so `t()` falls through to English and the cloud confirm gate keeps
recognising it — `outbound-agent-messages.test.ts` owns that invariant.

**P3 is now enforceable.** `high-frequency-namespace-parity.test.ts` was scoped
to four namespaces because full parity would have been a permanently red build.
That restriction is obsolete, so it is replaced by
`all-locales-key-parity.test.ts`, which asserts:

- every pack defines every `en` key;
- no pack defines a key `en` lacks (objectui#2872 part b was 74 keys of exactly
  this, hidden behind a component-private fallback);
- **placeholders match `en` per string** — both `{{count}}` and the single-brace
  `{count}` form, which two `gantt.autoScheduleDlg.*` keys use on purpose
  because their call site does a literal `.replace('{count}', …)` rather than
  i18next interpolation. A translation that drops a placeholder renders a
  sentence with a hole in it and no error, so this is checked mechanically
  rather than by eye.

All three assertions were mutation-tested, including the single-brace form.

### A bug the test suite could not have caught

The first merge pass produced **duplicate keys** in four packs: the key list is
the union of what is missing across all eight, but the insert ran
unconditionally, so packs that already had `detail.created` / `detail.updated`
got a second copy. Every test still passed — at runtime the later property
simply wins, so the parity check saw a perfectly consistent object.

`tsc` caught it as TS1117 during `turbo build`. ESLint does not flag it, and a
runtime test *cannot* — the duplicate is already collapsed before JS sees the
object. The compiler is the only possible guard here, and CI runs it. The merge
script now filters per pack against what that pack actually defines.

### Translation quality

Model-generated, and dense domain terminology (Gantt dependency types, the
import wizard's upsert/match-field vocabulary) is exactly where that is
weakest. This was raised before starting and the work was requested anyway, so
it ships as a **reviewable first draft, not a finished localization** — native
review is still worthwhile. What *is* verified mechanically: key parity in both
directions, placeholder shape per string, and that no outbound agent message
was translated.
