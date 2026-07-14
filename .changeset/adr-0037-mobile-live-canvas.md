---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(console-ai): Live Canvas is a full-screen, opt-in preview on mobile — not a broken split (#2481)

On a phone the beside-chat Live Canvas split overflowed the viewport (the chat
column's fixed min-width plus the preview exceeded the screen, and the resize
handle is desktop-only, so it was stuck clipped). Under `md` the canvas is now:

- **Full-width chat, no split** — the build streams in the chat as before.
- **Opt-in + full-screen** — when the preview is available a floating "Preview
  app" pill appears; tapping it (or a Preview button on a draft card) takes the
  canvas full-screen over the chat. Closing returns to the chat with the
  preview one tap away. The auto-drafted canvas never covers the streaming
  chat unprompted.

Desktop is unchanged (the resizable beside-chat split). Adds the
`console.ai.previewApp` string (en/zh).
