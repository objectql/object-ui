---
---

Test-only change: the `handler-keys-string-any-mirrors-7344` census now runs its `git grep` anchors through PCRE (`-P`) instead of POSIX ERE (`-E`), and pins an engine self-test that names the engine when it lacks `\b`. No published behaviour changes.
