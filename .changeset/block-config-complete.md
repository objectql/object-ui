---
"@object-ui/app-shell": minor
---

Complete the page-editor block configuration and prune shell-only blocks. Adds configurable property panels for the remaining content blocks with authorable properties — `page:accordion`, `record:path`, `record:quick_actions`, `ai:chat_window`, `ai:input` — so every page-content block in the palette is configurable in the UI (pure containers like `page:section` / `element:divider` correctly have no panel). Removes shell-singleton blocks (`app:launcher`, `global:notifications`, `user:profile`) from the page block palette — those are provided by the app shell, not authored as page content.
