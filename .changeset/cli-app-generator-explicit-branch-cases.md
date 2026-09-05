---
---

Test-only change to `@object-ui/cli`'s app-generator suite: two added cases pin the
generator's IN-WORKSPACE and STANDALONE context branches explicitly, instead of
inheriting whichever one the ambient cwd happens to select (objectui#7807). No
published behaviour changes.
