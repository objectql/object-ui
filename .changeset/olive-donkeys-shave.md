---
---

Test-only change: pins the console record header's built-in Edit against a `userActions.edit.visibleWhen` written with the session user and a relation field (`os.user.id != record.executor`), on both the bare-foreign-key and `$expand`ed payload shapes. The behaviour itself already shipped; no published behaviour changes.
