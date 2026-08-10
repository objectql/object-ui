---
"@object-ui/i18n": patch
---

Backfill the `marketplace` and `preview` namespaces' 37 missing locale keys plus the `marketplace.disclosure.runtime.` template-key family (objectui#3546, slice five)

`scripts/check-i18n-call-site-keys.mjs` (objectui#3530) measured 37 keys that a
`t()` call site asks for and that **no locale pack defined** — 37 distinct keys at
37 call sites across five console components — plus one `missing-prefix` family
whose static head matched no `en` key at all, so every expansion missed. All 37
carried an inline `t(key, { defaultValue: 'English' })`, which is exactly the
objectui#3517 class: English rendered correctly, and **all ten languages were
stuck on it** for months. Nothing here rendered a raw key — slice one (PR #3583)
held those sites.

What that meant on the page for a `zh` (or `ja`, `de`, `ar`, …) user: the
marketplace's "Your organization" strip, its Install / Installing… / Installed
buttons and the version-update affordances were English; the whole ADR-0025 PD4
**pre-install permission disclosure** was English — "This package contains code",
the trust-tier badge, "Reviewed & approved" / "Not yet reviewed" / "Signed", the
four permission group labels (platform services, lifecycle hooks, network,
filesystem) and the consent checkbox the user ticks to accept them; the ADR-0045
unpublished-app banner and its publish toasts were English; and the entire
ADR-0067 build-history sheet — title, description, the per-commit labels, the
Revert button and both of its result toasts — was English.

`marketplace.disclosure.runtime.` is repaired as an **enumeration, not a
wildcard**: its value surface is the closed trust-tier enum
(`PluginRuntimeSchema` = `z.enum(['node', 'sandbox', 'worker'])`, ADR-0025 §3.6),
so all three members are backfilled and the family leaves the ratchet's
`missingPrefixes` (3 → 2). A test reads the component's own fallback map and
fails if a fourth tier is ever added without a key — the job the prefix entry
used to do.

Each `en` value is byte-identical to the inline `defaultValue` it replaces (36 of
36 literal sites; the 37th's `defaultValue` is a template literal whose
`${pkg.display_name}` becomes the `{{name}}` hole its call site already passes),
so no English string a user sees today changes. The nine translations follow each
pack's own neighbourhood — including two namespaces that legitimately take
**different** second persons in `zh` (`marketplace` 你, `preview` 您) — and reuse
an existing neighbour's translation wherever the `en` string already existed
verbatim, so one English string never renders as two different sentences in the
same language.

No component changed: an AST sweep of the whole `marketplace.*`/`preview.*`
call-site surface found the slice's own dead-`||`-fallback count to be zero.
