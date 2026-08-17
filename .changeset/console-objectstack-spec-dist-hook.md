---
---

Build tooling only (objectui#4854). `apps/console/vite.config.ts` now honours
`OBJECTSTACK_SPEC_DIST`, the spec twin of the existing `OBJECTSTACK_CLIENT_DIST`
hook, so a framework build can bundle the console against its own
`@objectstack/spec` instead of the last published one. Mechanism ruled on
objectstack#8134; the framework half (`scripts/build-console.sh`) lands after an
objectui SHA carrying this hook is pinned.

No release: nothing under a published package's `src/` changed, and with the
variable unset the console's config is byte-for-byte the build it was before —
the alias table, the pre-bundle list, the `vendor-objectstack` chunk test and the
dev server's `fs.allow` all keep their baseline values.

The client hook is one prefix alias, which is only safe because
`@objectstack/client` exports a single entry. `@objectstack/spec` publishes an
18-entry exports map that redirects every subpath into `dist/`, so the injection
is derived from the override's own map — one alias per entry, subpaths ahead of
the bare specifier — rather than from a hand-written rule. Every failure mode
(path absent, not the spec package, an exports entry naming a file the built
package does not contain, a wildcard pattern) throws with the offending value
named: a lenient fallback to the installed spec would silently rebuild the exact
skew the hook exists to end.
