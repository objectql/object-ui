---
'@object-ui/cli': patch
---

`objectui serve` gains `--no-open`, matching the flag `objectui dev` already ships, and no
longer prints a bare `Error: spawn xdg-open ENOENT` stack after its success banner in a
headless environment.

**`--no-open`.** `serve` hardcoded Vite's `open: true` and its only options were
`--port`/`--host` — `dev` already had `--no-open` (`options.open !== false`), so the same
invocation behaved inconsistently across the two commands. `serve` now threads the same
flag the same way; the default is unchanged — with the flag omitted, `serve` still opens a
browser exactly as it always has (objectui#4924).

**The headless spawn failure.** Vite's own browser-open step already catches a failed
`open(url)`, but reports it via `logger.error(err.stack || err.message)` with no
`{ timestamp: true }`, so the default logger prints the bare Node `ChildProcess` stack with
no `[vite]` prefix and no context — and because that promise chain is fire-and-forget from
`server.listen()`, it lands *after* the "✓ Server started successfully!" banner, reading
like a crash even though the server is fine. There's nothing in `serve.ts` to try/catch —
the error never leaves Vite. `serve` now supplies a `customLogger` that wraps Vite's default
logger and replaces exactly that message with a short, contextual line naming the missing
opener binary (`(could not open the browser automatically — 'xdg-open' is not available in
this environment; open the URL above manually)`); every other log call — including
unrelated errors — passes through unchanged.

Sibling card objectui#4923 (project-root detection on the same command) is intentionally
untouched here; it is a separate defect with a separate PR.
