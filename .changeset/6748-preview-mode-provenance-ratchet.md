---
---

Test-only change in `@object-ui/auth`: `auth-spec-parity.test.ts` now watches
`PreviewModeConfig`, the `@objectstack/spec/kernel` symbol that
`packages/auth/README.md:328` claims the preview-mode prop aligns with. Upstream
retired that symbol in source and registered it as `kernel/PreviewModeConfig` in
`RETIRED_DEFS_BY_MAJOR[18]` (objectstack#11846, landed as objectstack PR #12718), so
it leaves the published set at spec major 18 — it is still exported by the 17.2.0 this
repo resolves, which is why the assertion ships green. It goes red at the spec-18 bump,
the exact moment the README sentence stops being true, which is the signal to correct
that line and delete the guard (objectui#6748).

The README line is deliberately NOT edited here: rewriting it while the symbol still
resolves on 17.x would make it wrong in the opposite direction. No source file, no
published behaviour and no `AuthProvider` prop change — the prop is host-supplied and
stays (objectui#6654).
