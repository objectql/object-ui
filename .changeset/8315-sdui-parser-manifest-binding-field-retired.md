---
'@object-ui/sdui-parser': minor
---

Retire the `binding: 'field'` arm on the manifest READER and PRODUCER faces, so
`@object-ui/sdui-parser` states one vocabulary instead of two (objectui#8315).

The 2026-09-07 maintainer ruling on objectui#6950 (director decision batch #69)
retired the zero-writer `'field'` arm under ADR-0049 enforce-or-remove, naming
**one** coordinate: `RegistryConfigLike.inputs[].binding`, the serializer's input
boundary, which PR #8297 narrowed. Two declarations in `types.ts` kept the arm, so
the published package narrowed on one face and stayed wide on the other:

- `ManifestInput.binding` — now `'object'`
- `ManifestValidationResult.bindings[].kind` — now `'object'`

**Breaking for TypeScript consumers, deliberately, and compile-time only.** A
hand-written `Manifest` literal or a `bindings[]` entry that spells `'field'` is now
a `tsc` error. Runtime behaviour is unchanged: types are erased, this package has no
runtime validator for a manifest it is handed, and `validateTree` still forwards
whatever a manifest says — a pin in
`src/__tests__/injected-component-input-6950.test.ts` states that limit so the
narrowing is not mistaken for a runtime rejection.

**Migration.** Nothing measured has to change. `binding: 'field'` has zero writers in
this repo and zero in the objectstack copy of this package (measured 2026-09-09 on
both heads, each with a firing `binding: 'object'` control), and the only manifest
producer in either tree is `manifestFromConfigs`, whose input face was already narrow.
The two `binding: 'field'` occurrences in this repo are `@ts-expect-error` negative
pins asserting the refusal, not writers.

**Why not leave the reader face wide.** The counter-argument — producer → reader is a
subset relation, so a permissive reader is not wrong — was answered rather than assumed
away. `ManifestInput` is not a pure reader face (`manifestFromConfigs` returns it), and
`bindings[].kind` is a pure **producer** face where the relation inverts: a wider union
there accepts nothing extra, it obliges every consumer to handle an arm this package
cannot emit. The two are coupled by `validateTree`'s `kind: input.binding` assignment,
so narrowing one alone would need a cast at the only conversion site — the lenient
fallback AGENTS.md #0.1 bans. The reasoning now lives on the declarations themselves,
where a later reader lands. The reopen route is the ruling's own: a measured need for
field bindings is filed as a widening with the vocabulary decided then.
