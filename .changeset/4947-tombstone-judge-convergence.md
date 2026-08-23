---
---

Test-infrastructure convergence, no shipped code touched: the last two local copies of
the ADR-0087 D2 tombstone criterion — in `packages/plugin-detail`'s
`recordDetailsInputs` spec-parity test and `packages/app-shell`'s `block-config`
preview test — now import `@object-ui/test-support`'s shared judge instead of
spelling out `unwrap()._def.type === 'never'` by hand. Both copies carried the
structural channel alone; the shared judge OR-s it with the `[REMOVED]` description
channel, so neither channel can go quietly permissive on its own, and every
tombstone-aware gate in the repo now moves together when the criterion changes.
