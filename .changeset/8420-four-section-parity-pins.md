---
---

Correct four sections of `content/docs/guide/ci-cd-pipeline.md` against what their
workflow jobs actually run, and pin each one with a `commandParity` unit
(objectui#8420). Documentation and test only; no package is released by this change.

- **Performance Budget** hid two gates. `pnpm check:sdui-registration-pins` runs in a
  step of its own with no `continue-on-error` and the section named neither SDUI nor
  registrations; `pnpm check:eager-closure` is the second half of the budget step
  itself, whose exit code that step captures and fails on — so the section's rule
  *"Exactly one bundle-size number in this repository is enforced"* was false. The
  table now carries both enforced rows. The closure ceiling's **value** is
  deliberately not restated on the page and is asserted absent.
- **Skill Examples**, **Spec Range Floors** and **Changeset Release** each described a
  build in prose without naming it (`turbo run build`, `turbo run build`, `pnpm build`).
- The Changeset Release section's quote of `pnpm changeset:publish` was missing that
  script's `check-spec-range-floors.mjs` leg, and its two publish-lane gates reach the
  runner through `changesets/action@v1`'s `publish:` input — invisible to a `run:`-only
  reader. Both are now declared as expected non-`run:` commands, in both directions, so
  neither can be "fixed" off the page nor quietly widened into an allowlist.
