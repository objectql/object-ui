---
---

Dev/build configuration only — this publishes nothing, declared explicitly with an
empty frontmatter rather than left undeclared. No package `src/` is touched. The
files changed are `apps/console/.env.development`, `examples/console-starter/.env.*`
and `examples/console-starter/vite.config.ts`; `.env.development` is not part of
`@object-ui/console`'s published artifact (`files: ["dist"]`, built from
`.env.production`, which is untouched), and the example is private and on the
changeset `ignore` list.

Converge the dev stacks on one origin: empty `VITE_SERVER_URL` and let the Vite
proxy do the split-host hop.

Both dev env files pointed `VITE_SERVER_URL` at `http://localhost:3000` while the
page was served from `:5180` (console) and `:5173` (starter). Every client in these
apps coalesces an unset value to `''` and then builds a relative `/api/...` URL, so
an empty value routes same-origin through the dev proxy instead. `console-starter`
had no `server` block at all, so it gets the same one-stanza `/api` proxy
(`DEV_PROXY_TARGET` or `http://localhost:3000`) that `apps/console` already carries;
no port is pinned, because its README documents the example on Vite's default 5173.

This is the ruled prerequisite for the `sameOriginOnly` action-runtime default. Under
that default a non-empty `VITE_SERVER_URL` makes every relative-target `type: 'api'`
action resolve cross-origin and be fetched bare — no `Authorization`, no
`X-Tenant-ID`, no `Accept-Language` — i.e. a 401 for the standard `pnpm dev` stack.

`examples/console-starter/.env.production` is emptied too. Its committed
`https://demo.objectstack.ai` was not a deliberate choice for the example: it is the
same pre-convergence value the sibling console carried until 2026-05-24, when
`c351c9604` ("default published SPA to same-origin") cleared it there for CORS-blank
-page reasons and touched only `apps/console/.env.production`. The starter was left
behind by that commit, and as a fork-ready scaffold its committed value is the
production origin every fork inherits. Split-origin deployments inject
`VITE_SERVER_URL` at build time, the way the console's own `.env.production` already
documents.
