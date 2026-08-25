---
"@object-ui/plugin-form": minor
"@object-ui/types": minor
---

`navigateOnSuccess` is relative-only, escapes the interpolated id, and is deprecated in favour of `submitBehavior`

The url contract for this key was undeclared: it was same-origin-guarded (so a same-origin
ABSOLUTE value was accepted), it interpolated `{id}` / `{recordId}` without escaping the
substituted value, and nothing said which of those was intended. The maintainer ruled it on
2026-08-17: `navigateOnSuccess` is the pre-ruling ancestor of the `submitBehavior` family
rather than a second dialect, so as a compat alias it runs under the semantics
objectstack#7496 ruled for that family.

**Relative paths only.** A same-origin absolute such as `https://own-host/record/{id}` is
now refused like any other out-of-contract value, rather than accepted and navigated at
browser level. The destination is authored metadata, which is exactly where an address
somebody else chose gets copied in. Cross-origin and protocol-relative values were already
refused and still are; every relative shape that worked before still works.

**The interpolated id is URL-escaped.** `/r/{id}` with an id of `a/b c` resolved to
`/r/a/b c`, silently growing a path segment, and a template of `{id}` let the id become the
whole destination. The substituted value now goes through `encodeURIComponent`, so a token
is a value in the path and never a way to add path structure. The template is the author's
and is untouched — only the id, which is data read off the written record, is escaped.

Both halves are needed and neither implies the other: relative-only is a rule about where a
destination starts, so it cannot see structure injected further along; escaping runs only on
the substituted value, so it cannot see an absolute the author wrote out.

This can only narrow what is reachable. Every destination the key now accepts is a relative
reference, and a relative reference cannot carry an authority, so it was already accepted by
the same-origin guard this replaces — no value that was refused is now followed. With every
accepted destination relative, the browser-level `window.location.assign` fallback at both
call sites became unreachable and was removed; an accepted destination goes to the injected
navigation seam, and the absent-seam fallback inside the shared hook is unchanged.

**Deprecation.** `navigateOnSuccess` is marked `@deprecated` in favour of `submitBehavior`,
which already takes precedence over it and carries the richer `{{record.field_name}}`
interpolation. The `{id}` / `{recordId}` dialect keeps working for forms that already
declare it — the ruling converges the documentation and the semantics, not the spelling.
