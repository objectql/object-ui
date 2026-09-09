---
'@object-ui/types': minor
---

**Breaking for `@object-ui/types` consumers:** the `Cloud` type namespace is
REMOVED from the package's root entry. `export type * as Cloud from
'@objectstack/spec/cloud'` is gone, so `import type { Cloud } from
'@object-ui/types'` and every `Cloud.X` member access now fail to compile
(TS2305 / TS2694). No alias and no deprecation window are left — the maintainer's
standing posture is immediate removal (objectui#8225; step 2 of 3 of the
objectstack#16325 ruling, option B: the cloud control-plane contracts leave
`@objectstack/spec`, and the spec's `./cloud` subpath is deleted upstream once
cloud and objectui stop importing it).

The rest of the namespace family — `Data`, `UI`, `System`, `AI`, `API`,
`Automation`, `Shared`, `QA`, `Kernel`, `Contracts`, `Integration`, `Studio`,
`Identity`, `Security` (14 re-exports) — is unchanged; the gap in that block is
deliberate and is marked in place.

Measured in this repository at `289d14687`: zero consumers of the `Cloud`
namespace across `packages/**` and `apps/**` (a `Cloud.` member-access census
plus a named-import census over 4106 tracked ts/tsx files, both 0, with a
firing control: the same PCRE pattern hits the consumed sibling namespaces
`UI.` and `Data.`), and zero imports of the spec's cloud subpath outside
that one line — the three cloud-shaped types objectui does use
(`PackageTranslation`, `resolvePackageL10n`'s result, `PackageManifest`) were
already declared inline in `app-shell` rather than imported. No runtime
behaviour changes; the emitted JavaScript is identical.
