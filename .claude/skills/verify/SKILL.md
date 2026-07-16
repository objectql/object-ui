---
name: verify
description: Verify metadata-admin designer (previews) changes end-to-end in a real browser without a backend, via the console preview gallery.
user-invocable: false
---

# Verifying metadata-admin designer changes (no backend needed)

The console ships a dev-only gallery that renders every registered metadata
designer (`packages/app-shell/src/views/metadata-admin/previews/*`) with
representative sample drafts, in edit mode, with zero backend:

```bash
cd apps/console && pnpm exec vite --port <free-port> --strictPort
# open http://localhost:<free-port>/preview-gallery.html
# isolate one designer: /preview-gallery.html?only=flow   (or ?only=dashboard, page, …)
```

Sample drafts live in `apps/console/src/preview-samples.ts` (keyed by metadata
type: `flow`, `workflow`, `object`, …). Server-driven affordances (e.g. the
flow palette's `GET /api/v1/automation/actions`) fail fetch and fall back to
their hardcoded defaults — that IS the offline path, not an error.

## Driving it headlessly

The chrome-devtools MCP may lack a Chrome binary in remote sessions. Use the
repo's own Playwright instead — the pre-installed executable is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (probe with
`find /opt/pw-browsers -name chrome` if the version moved):

```js
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '<probed path>' });
```

Gotcha: a driver script must live **inside** the repo (e.g.
`node_modules/.drive.mjs` — ignored by git) so Node resolves
`@playwright/test`; a script in `/tmp` won't resolve workspace deps.

Useful selectors: cmdk internals are addressable via `[cmdk-item]`,
`[cmdk-group-heading]`, `[cmdk-empty]`, `[cmdk-item][data-selected="true"]`;
flow canvas node cards match `.group.absolute`.

Cleanup: kill only the vite server you started (`kill $(lsof -ti tcp:<port>)`).
