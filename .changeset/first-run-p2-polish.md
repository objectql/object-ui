---
"@object-ui/i18n": patch
"@object-ui/app-shell": patch
---

First-run UX polish (objectstack-ai/objectui#2038) — copy improvements found via the ObjectOS Cloud signup walkthrough:

- **"Organization" → "Workspace"** across the org picker (`organizations.*` strings, en + zh). The create flow + WorkspaceSwitcher already say "workspace"; the picker ("Your Organizations / No organizations yet") was the lone holdout. Now consistent.
- **Non-admin empty state** — "There are no applications available to you yet. Please contact your workspace administrator." → "Your workspace is being set up — apps your admin shares with you will show up here." (less dead-end, en + zh).
- **Cold-start reassurance** — new `console.loadingHint` line under the LoadingScreen steps: "Setting up a new environment can take a few moments." (en + zh).
- **Signup value-prop** — register subtitle "Enter your information to get started" → "Create your account to start building." (en + zh).
