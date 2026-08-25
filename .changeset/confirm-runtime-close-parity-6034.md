---
'@object-ui/app-shell': patch
---

Console action runtime: closing an action confirm dialog now keeps the dialog's
text instead of blanking it mid-fade.

`useConsoleActionRuntime` reset its confirm state by replacing the whole object
(`{ open: false, message: '' }`), which cleared `message` and dropped `options`.
Radix keeps `AlertDialogContent` mounted through its exit animation, so the
dialog's description went blank and its title and button labels reverted to
their defaults while it was still fading out. It now flips only `open` and keeps
every field, matching `RecordDetailView`'s second confirm runtime, which already
closed this way. Both runtimes feed one `ActionConfirmDialog`; the parity pin now
covers the close path as well as the open path.
