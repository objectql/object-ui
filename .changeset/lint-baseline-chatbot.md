---
"@object-ui/plugin-chatbot": patch
---

chore(lint): clear the baseline lint errors in plugin-chatbot (objectui#2713 Wave 3)

Wave 3 of the #2713 lint-gate restoration. `@object-ui/plugin-chatbot` was red at
baseline on `main`; cleared every **error** (no behavior change; warnings out of
scope):

- **`react-hooks/rules-of-hooks` in `useObjectChat` (8)** — the hook called
  DIFFERENT `useCallback`s in each of its two `isApiMode` return branches, so
  both sets were conditional (React throws if the mode toggles between renders).
  `useChat` was already called unconditionally; this destructures its result and
  hoists all eight callbacks (3 API + 5 local) above the `isApiMode` branch, so
  the same hooks run in the same order every render. Only the returned surface
  differs by mode — the callback bodies are unchanged (the API `messages` local
  is renamed `apiMessages`). Verified against the `useObjectChat.sendFailure` /
  `handoffContext` / `ChatbotEnhanced.sendError` suites.
- **`react-hooks/rules-of-hooks` in `FloatingChatbotTrigger`** —
  `useChatbotLabel` wrapped the provider-safe `useObjectTranslation` in
  try/catch; removed the wrapper (the #2709 fix).
- **`react-hooks/static-components` in `shimmer`** — `motion.create(Component)`
  genuinely builds a motion component and must key off the `as` prop, so it
  can't be module-scoped. Memoized per `Component` (stable across renders,
  avoids the remount) and carries a justified scoped disable at the render site.
