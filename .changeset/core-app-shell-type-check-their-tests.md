---
---

chore(core,app-shell): `@object-ui/core` and `@object-ui/app-shell` type-check their whole test trees.

No published behaviour moves. Each package gains a `tsconfig.test.json` chained
from `type-check`, their 56 and 62 code-tier test errors are fixed, and the
narrow `tsconfig.typetests.json` rescue hatches — for packages still in
`TEST_DEBT` — are retired now that the full projects compile the same files
(objectui#4040 tranche 5, under objectui#4291's ratchet). Three small source
corrections ride along, each one a declaration that was narrower than the
implementation it described: `ConsoleActionRuntime.actionProviderProps` is now
derived from `ActionProviderProps` instead of restating it (the restatement had
dropped `onModal` and declared one-parameter handlers), `apiHandler` declares the
`context` parameter it has always taken, and `AiChatPage` imports the enhanced
chat-message type it actually produces rather than the minimal legacy one.
