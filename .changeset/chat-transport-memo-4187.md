---
'@object-ui/plugin-chatbot': patch
---

`useObjectChat` no longer rebuilds its `DefaultChatTransport` on every render
(objectui#4187).

The transport `useMemo` listed the caller's `body` and `headers` in its dep list.
Both are object props and every caller passes a fresh literal each render — the AI
page's chat pane builds its `body.context` inline — so the memo never hit and a
transport was constructed on every render of every chat surface, which during a
streaming turn is once per token batch.

`body` and `headers` are now read through refs inside
`prepareSendMessagesRequest`, the idiom this hook already uses for the live model
(`modelRef`) and the handoff conversation id (`parentConvRef`), and they are gone
from the dep list. Unlike memoizing at each call site, a future caller cannot
undo it.

No user-visible behaviour changes: `@ai-sdk/react` keeps the transport in a ref
and re-keys its `Chat` only on `chat`/`id` (verified against the installed
4.0.68), which `useObjectChat` passes neither of, so the message thread was never
at risk — the rebuild was pure waste. The one real difference is *when* the two
values are sampled: a send now reads them at send time, so it observes the values
of the most recent render instead of those of the last render that happened to
rebuild the transport. That is never staler than before, and it is pinned by
`useObjectChat.transportIdentity.test.tsx`.
