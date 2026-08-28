---
'@object-ui/app-shell': minor
'@object-ui/plugin-chatbot': patch
'@object-ui/i18n': patch
---

The Studio copilot tells the agent WHAT the user is discussing (cloud#1610 send half): `ChatPane` accepts a `surfaceContext` and sends it as `context.surface` on every turn (the transport reads the body per send, so it stays fresh); the Studio copilot derives it from the URL alone — the `:tab` pillar segment plus the `?surface=type:name` deep-link the pillars already mirror, so the artifact carries its type discriminator (page/object/dashboard/report). A display chip above the composer (「正在讨论：…」, new `console.ai.discussing` key in all ten packs) makes the sent context visible instead of invisible grounding.
