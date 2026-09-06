---
---

Make a per-block member pin MANDATORY for every `array`/`object` typed
registered input on a spec-carried block (objectui#8068).

`apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` compares
top-level key names and delegates member shapes to per-block tests beside the
renderers — but nothing required one. `page:header.actions` is the key that
proves it: array-typed, member shape in `description` prose only, spec
`z.array(z.string())` while the renderer read the members as objects, and every
layer green for a full contract cycle until a human filed it.

The new direction judges the same `covered` set as the rest of that file: every
array/object-armed input must name a pin whose file exists, is collected by the
runner, and names both the block and the key — or carry an explicit,
issue-backed exemption. Measured first, as the card required: 77 such inputs, 19
already pinned, 58 not, so the route is the transition this repo already uses —
all 58 listed by name, self-deleting once a key acquires a pin, under a ceiling
that may only ratchet down. `objectui#8071` owns converting them.

Test only; no package is released by this change.
