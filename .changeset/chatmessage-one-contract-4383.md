---
'@object-ui/plugin-chatbot': minor
---

`@object-ui/plugin-chatbot`'s `ChatMessage` is now one type instead of two

The barrel exported two different `ChatMessage` types: a minimal one it declared itself (`id` / `role` / `content` / `timestamp` / `avatar` / `avatarFallback`) and the shape `<ChatbotEnhanced>` actually renders, re-exported under the alias `ChatbotEnhancedMessage`. The natural name resolved to the narrow one, so an importer reaching for `ChatMessage` silently got the wrong contract — and the compiler could not object, because both shapes existed on purpose and every construction site spreads the extra keys conditionally, which defeats excess-property checking. That is how app-shell's `AiChatPage` ended up unable to read `toolInvocations` off its own function's return value (objectui#4040; re-pointed in PR #4379, but the collision itself was left standing). objectui#4383.

**Breaking semantics** (declared `minor` per AGENTS.md §版本号策略 — objectui never declares `major` outside an `@objectstack` major sync): `ChatMessage` exported from `@object-ui/plugin-chatbot` now denotes the enhanced shape. In practice this is a widening rather than a removal — every field of the retired shape survives with the same type, and the enhanced shape adds only optional keys (`streaming`, `toolInvocations`, `reasoning`, `sources`, `traceId`, `buildProgress`, `blueprintProgress`, `charts`), so anything that was a valid `ChatMessage` still is, and `<Chatbot messages={…} />` keeps accepting the same values. Code that relied on the name meaning *exactly* the six-key shape (exhaustive `keyof` maps, `Equal`-style assertions) is the case that changes.

`ChatbotEnhancedMessage` is kept as a `@deprecated` alias of the same type, so importers that spelled the disambiguating name keep compiling; new code should import `ChatMessage`. Pinned at compile time by `packages/plugin-chatbot/src/__tests__/chat-message-contract.test.ts`.
