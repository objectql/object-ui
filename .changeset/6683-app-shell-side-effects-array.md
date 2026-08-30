---
'@object-ui/app-shell': minor
---

`@object-ui/app-shell` now publishes a precise `sideEffects` ARRAY.

**What this means for a consumer.** Until now the package declared no
`sideEffects` field at all, which every bundler reads as "assume every module in
this package does something when it is imported" — so nothing in the package
could be tree-shaken, and importing one named export from the barrel pulled in
the barrel's whole reachable graph. The package now names exactly the modules
that DO something on import: its entry forms (including `./styles.css`, which a
bundler must never drop) and the ten modules that register SDUI widgets, admin
components and metadata resources at load time. Everything else is now
shakeable, so a consumer's bundler may drop the parts of `@object-ui/app-shell`
their app does not use.

⚠️ **If your build depends on a module of this package being evaluated for its
side effects without importing anything from it, and that module is not one of
the ten named**, it may now be dropped from your bundle. Import the value you
need by name, or call the registration explicitly. Measured on this repo's own
console: 56,668 gzipped bytes left the eager closure and every SDUI registration
stayed present.

`"sideEffects": false` was NOT adopted and remains disproven by measurement: it
drops three live SDUI widget registrations (`mcp:connect-agent`,
`cloud:onboarding-next`, `cloud:ai-model-status`) to zero chunks on a green
build with no warning anywhere.

Two gates ship with the array, because an INCOMPLETE array fails silently inside
a consumer's bundle and would otherwise have no witness:
`scripts/check-side-effects-array.mjs` re-derives the enumeration from the module
bodies and fails when the array and the derivation disagree in either direction,
and `scripts/check-sdui-registration-pins.mjs` weighs the built console for every
registration the array promises to keep.
