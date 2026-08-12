---
'@object-ui/app-shell': patch
---

`AiChatPage` narrows the chat hook's messages through the exported `toRuntimeMessages` adapter instead of five casts

`useObjectChat` returns `ObjectChatMessage[]` — the shape both of its modes really produce (objectui#4424) — which is wide where local mode is wide: it keeps the authored `'tool'` role and the legacy `'partial-call'`/`'call'`/`'result'` tool states. This page wants the runtime shape, and said so five times with `messages as ChatMessage[]` (plus one `as unknown as` double cast). The narrowing was real and the casts were legal; what was missing is that a cast erases the whole difference rather than the intentional part of it, so nothing recorded which narrowing was meant and nothing could go red when it changed.

There is now one conversion where the hook's values enter the page's runtime-typed world, memoized on `messages` exactly as the plugin's own three renderers do (objectui#4399). All five sites read it; no cast replaces them, and the `as unknown as` double cast at the bound-package derivation turned out to be unnecessary once the value is honestly typed.

One behaviour changes, and it is the one the fold was measured for. `sanitizeChatMessagesForCache` declares its parameter's role as `'user' | 'assistant' | 'system'` — it has always asked for folded roles, and the cast is what let an unfolded `'tool'` past that declaration. Measured on a thread carrying one: the entry was cached as `role: 'tool'`, which the cache's own reader then rejects, so the message vanished on a cache-fallback reload; and because sanitize gates tool serialization on `role === 'assistant'`, that turn's tool invocations — including the re-serialized draft envelope behind "Review N changes / Publish" — never reached the cache at all. Folded, both survive the reload they exist to survive. The other two compute sites were measured to be fold-insensitive and are unchanged: `isConversationZh` reads `role === 'user'` and the text, which the fold can neither create nor destroy, and `deriveBoundPackageId` walks every message irrespective of role and reads keys the adapter spreads through.

Nothing on screen moves today: neither a `'tool'` role nor a legacy tool state is producible on this page's own paths, since hydration yields runtime roles and API mode's values come from `mapMessages` with v6 states already. This closes the hole ahead of a value that can reach it, and makes a future vocabulary move surface as a type error at the host rather than as rendering behaviour.
