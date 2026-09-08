---
---

Internal only — no published behaviour changes, so this declares "no release"
deliberately rather than carrying a bump.

`eslint.config.js` now scopes `@typescript-eslint/consistent-type-assertions`
with `assertionStyle: 'never'` to `packages/core/src/registry/Registry.ts`, and
the two source-text `not.toMatch` assertions that used to stand for the same
claim in `packages/types/src/__tests__/injected-component-input-6950.test.ts`
are retired (objectui#8316). The only edits under a published package's `src/`
are that pin's removal and one docblock sentence in `Registry.ts` naming the
guard that replaced it; the emitted code is byte-identical.
