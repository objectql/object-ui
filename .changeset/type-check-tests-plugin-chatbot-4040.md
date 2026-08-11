---
---

Releases nothing on purpose: `@object-ui/plugin-chatbot` now type-checks its seventeen
test files (`tsconfig.test.json` chained from `type-check`), and its `TEST_DEBT` entry is
gone. Only test sources changed; no published behaviour, and no public type, moved.

Both declared code-tier errors were the `TS2353` dialect shape, and one of them was hiding
a case that passed for the wrong reason:

- `ChatbotEnhanced.test.tsx`'s extend-badge case passed `planExtendLabel` inside `labels`,
  but that is a top-level prop of `ChatbotEnhancedProps`, not a member of `ChatbotLabels`.
  The component therefore rendered its default, `"Adding to existing app"` — and the
  expectation was `toContain('Adding to')`, which the default satisfies. Green while the
  override it names was ignored. Fixed by passing the prop where the component reads it,
  with an override string that is deliberately not a substring of the default.
- `mapMessages.test.ts` spelled a tool state `'result'`, the AI SDK v4 name;
  `ChatToolInvocation.state` is documented as the v6 lifecycle and admits
  `'output-available'` for it. Nothing in `mapMessages.ts` branches on the value, so the
  fixture caught up with the dialect rather than the type being widened to admit the old
  spelling.
