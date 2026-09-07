---
---

Comment-only correction inside `packages/i18n/src/__tests__/fallback-placeholder-spelling-3512.test.ts` (objectui#8029): the header claimed the suite "imports nothing outside its own package" while importing `@object-ui/test-support/defaults-table-scan`, which arrived with objectui#7884. The paragraph now states the rule the file actually obeys — direction, not absence — as three checks a new import has to pass. No published behaviour changes: no runtime source, no assertion and no gate moved, and the edited file is a test under a directory this package's build `tsconfig.json` excludes from `dist`.
