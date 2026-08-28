---
---

Test-only change in `@object-ui/core`: renamed one `it()` in
`actionDef-closed-surface.test.ts` so its reported name cites `tsconfig.test.json`,
the project that actually compiles the file, instead of the retired
`tsconfig.typetests.json` (objectui#4040). No assertion, source file or published
behaviour changes — only the string the runner prints.
