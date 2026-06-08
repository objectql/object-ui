---
"@object-ui/app-shell": minor
---

SDUI: give PageView a console action runtime (#1605). Extract ObjectView's schema-action wiring into a reusable `useConsoleActionRuntime` hook (+ a `ConsoleActionRuntimeProvider` wrapper): confirm / param / result dialogs, the authenticated api / flow / server-action handlers, SPA navigation, the paused screen-flow runner, and a refresh callback. ObjectView now consumes the hook (behaviour unchanged), and PageView wraps its page schema in the runtime — so a page-level `action:button` can collect params, call authenticated API endpoints, show confirm/result dialogs, run screen flows, navigate the SPA, and invalidate embedded data after success. Pages run global (object-less) actions; the hook binds `objectName` only when one is present. This unblocks metadata-driven app home pages (e.g. a "Create environment" primary action) instead of bespoke React components.
