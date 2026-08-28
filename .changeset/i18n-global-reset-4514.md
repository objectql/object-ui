---
---

Test harness only, no published behaviour change (objectui#4514).

Mounting an `I18nProvider` in a test file left react-i18next's global
default-instance pointer on that provider's instance, so every later
provider-less render in the same file resolved through it — a failure that
surfaced hundreds of lines away, in a test nobody had touched, and passed when
run alone. `vitest.setup.base.ts` now restores the pointer after every test.

`I18nProvider` and `useObjectTranslation()` are unchanged: the global fallback
that makes the hook provider-safe stays exactly as designed. The five source
files in this change are all `*.test.*` plus their harness.
