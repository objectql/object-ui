---
---

Comment-only change in `@object-ui/core`: `ConfirmationHandler`'s declaration now
names the out-of-runner producer of its `options` bag, so a runner-scoped liveness
sweep no longer reads the parameter as declared-but-never-produced. No behaviour,
no type surface and no published output changes.
