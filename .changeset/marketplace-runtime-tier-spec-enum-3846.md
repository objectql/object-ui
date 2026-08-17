---
'@object-ui/app-shell': patch
---

The marketplace plugin trust tier is typed by the spec's own enum, so the install panel can no longer render a raw wire value as a trust label.

`MarketplacePackageVersion.runtime` was declared `string` while the producer
validates it against `@objectstack/spec`'s `PluginRuntimeSchema` —
`z.enum(['node', 'sandbox', 'worker'])`, ADR-0025 §3.6. Consumer looser than the
contract, and the looseness propagated into `PluginDisclosure`: the label map was
a `Record<string, string>` (so a missing tier could not be a compile error), the
badge fell back to `?? version.runtime`, and the translation key carried an
`as any`. That fallback rendered the raw wire string as interface copy on the
panel where a user grants a package the right to execute code — the one badge on
that panel that must never be guessed at (objectui#3846).

The field now binds the spec's `PluginRuntime`, which is what this same interface
already does one field over for `PluginPermissions`, for the same stated reason:
a local copy of a spec enumeration rots the day the spec adds a member. No new
dependency was needed — `@object-ui/app-shell` already depends on
`@objectstack/spec`, and this file already imports from
`@objectstack/spec/kernel`. The label map is keyed by that union, so it is total
by construction and the `?? version.runtime` arm it needed is gone along with the
`as any`.

No change to what a user sees for the three legal tiers — the labels are
byte-identical. What changed is that a fourth tier, or a `string`, stops
compiling: a new pin compares the map's keys against `PluginRuntimeSchema.options`
directly, and objectui#3546 slice five's pack-parity assertions now point at it
for that comparison instead of reading the map's `string` annotation.
