---
'@object-ui/plugin-detail': patch
---

Fix `record-alert` with `severity: 'success'` rendering a database glyph instead of a
check mark (objectui#7593).

`SEVERITY_STYLES.success.icon` was the string `'CheckCircle2'`. That literal reaches
`<LazyIcon name={…} />`, whose resolver degrades an unresolvable name to the `Database`
icon — deliberately, because server-driven schemas reference icons from other
libraries and it is better to degrade than to throw. The result was an emerald
"success" banner with a database glyph in it, on every such alert, silently.

The fix is the live spelling `'circle-check'`, and it is **substitution-free**: it was
derived by identity rather than remembered. On `lucide-react@1.31.0`,
`CheckCircle2 === icons.CircleCheck` is `true` — the same glyph object under two names
— so the repair cannot change which glyph is drawn, only whether one is drawn at all.
`CheckCircle2` remains a live named export, so static `import { CheckCircle2 }`
call-sites are unaffected; it is dead only for NAME-BASED lookup, which is the route
this constant takes.

The load-bearing half is a new pin, because nothing could catch this in either
direction. The icon gate does not judge dynamic-surface resolvers (its own verdict line
says so), and the renderer's suite mocks `LazyIcon`, so its assertion could only echo
the literal back — and it did, pinning the dead spelling. The pin consults the real
resolver and asserts that every `SEVERITY_STYLES` icon RESOLVES, rather than that it is
spelled any particular way, so it fails on the actual failure mode rather than
restating the diff.

The other three severities (`Info`, `AlertTriangle`, `AlertCircle`) are **not** changed
and were never defective: two of them are absent from lucide's `icons` record but
present on the dynamic surface (1767 keys vs 2025 names), which is the surface that
decides here, so they resolve and render correctly today.
