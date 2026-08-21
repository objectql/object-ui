---
---

Tests only: pin the console `sys_user_preference` request budget across one
mount (objectui#5544). Three distinct preference keys, one read each, and every
consumer still receives its own row. No runtime code changes, nothing to release.
