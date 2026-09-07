---
'@object-ui/types': minor
'@object-ui/plugin-chatbot': minor
---

`chatbot-floating` now fences its `<FloatingChatbot>` spread the same way its
two sibling registrations (`chatbot`, `chatbot-enhanced`) already do —
`{...toDomProps(props)}`, at the head of the element, instead of a raw
`{...props}` spread at the end (objectui#7708). This is a deliberate,
user-visible behavior change, not a refactor:

- **A message sent through a floating chatbot now actually renders.**
  Previously the authored `messages` seed (whatever array was on the node
  when it was authored) silently overrode the live runtime messages on every
  render, because the raw spread landed AFTER `messages={runtimeMessages}`.
  Neither the user's own message nor an `autoResponse` reply ever appeared —
  the identical send on `chatbot-enhanced` worked correctly. Fixed.
- **`displayMode`, `systemPrompt` and `model` stop leaking as DOM attributes**
  on the panel's root element (`systemPrompt` / `model` are still read
  normally, by name, for the request they configure — only the second,
  unfiltered forward is gone). Closes objectui#4425's leak class on the one
  `plugin-chatbot` registration that had not closed it yet.
- **Three undeclared keys go dark on `chatbot-floating` nodes:**
  `processVisibility`, `surface` and `showAvatars` reached the panel's
  `ChatbotEnhanced` through the raw spread even though `ChatbotFloatingSchema`
  never declared them. `ChatbotFloatingSchema` documents this explicitly and
  always has — the face never promised these keys — so this closes an
  accidental channel rather than removing declared behavior. A document that
  relied on any of the three to affect a floating node loses that effect;
  author them on a `chatbot-enhanced` node instead, where they are part of
  the declared, tested contract.

`@object-ui/types`: `ChatbotFloatingSchema`'s doc comment is updated to match
— no type-shape change, so nothing that imports the type needs to change.
