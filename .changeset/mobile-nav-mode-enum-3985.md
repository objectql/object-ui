---
'@object-ui/layout': minor
---

**Breaking (shipped as `minor`, following the `app-shell` component-key deregistration):**
`app-schema-renderer`'s `mobileNavMode` is now declared as the vocabulary the renderer
implements — `enum: ['drawer', 'bottom_nav']` — instead of free-text `string`, and the
third member of `MobileNavMode` is retired (objectui#3985, ADR-0049 enforce-or-remove,
maintainer ruling 2026-08-10).

**What used to happen.** The registration declared `{ name: 'mobileNavMode', type:
'string' }`, so `sdui-parser`'s `checkType` asked only whether the value was a string.
`mobileNavMode="bottom-nav"` — the hyphenated spelling of the underscored value, and the
likeliest typo on this key — passed the manifest gate, passed the parser, reached the
renderer, missed its one equality test, and rendered the drawer. Nothing reported
anything, at any layer. The declaration was WIDER than the implementation, which is why
the `invalid-enum` that should have fired never could.

**What happens now.** A value outside the vocabulary is an **error**-level `invalid-enum`
from `validateTree` / `compile`, so a schema-driven author — very often an AI author — is
stopped at the typo instead of debugging a mode that silently did nothing. The generated
`sdui-intrinsics.d.ts` narrows from `mobileNavMode?: string` to the two-value union for
the same reason.

**Retirement.** `MobileNavMode` had a third member documented as "collapsed sidebar" with
**zero read points** in `AppSchemaRenderer`: the only two reads are the `drawer` default
and the `=== 'bottom_nav'` comparison that gates the bottom bar, so the value was
behaviourally identical to the default while the union, the JSDoc and `ROADMAP.md`
presented it as a capability. It is gone from the union and from the published
vocabulary. Making it real behaviour is an implementation card first — the value comes
back together with a renderer read point, never as a declaration on its own.

**Migration.** Both implemented modes are unchanged; no runtime behaviour moves. A
TypeScript caller passing the retired literal now fails to compile (it previously
compiled and rendered the drawer), and a JSON/JSX author writing it — or any other
out-of-vocabulary value — now gets a validation error where they previously got silence.
In both cases the value that reproduces the old behaviour exactly is `drawer`.
