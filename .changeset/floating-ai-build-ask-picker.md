---
"@object-ui/app-shell": minor
---

feat(chatbot): reveal the Build/Ask switcher in the app floating assistant when AI dev is unlocked

The bottom-right FAB assistant bound each app to a single agent and hid the
agent picker unless `VITE_AI_SHOW_AGENT_PICKER` was set, so a user on an
AI-unlocked environment could not switch from `ask` (read-only data/query) to
`build` (authoring) without leaving for the full `/ai` page.

The picker now auto-reveals when AI development is unlocked for the viewer — the
live agent catalog serves BOTH an `ask` and a `build` agent (alias-aware, so
legacy `data_chat`/`metadata_assistant` count) AND authoring isn't
deployment-disabled (`aiStudio`). Pure end-user apps (only `ask`) stay clean and
never see a picker. An explicit `showAgentPicker` prop or
`VITE_AI_SHOW_AGENT_PICKER` still forces it on.
