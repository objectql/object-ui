---
---

Type `RecordDetailView`'s confirm handler as the published `ConfirmationHandler` instead of an inline re-spelling of the same shape, and pin that both of `app-shell`'s confirm runtimes hand `ActionConfirmDialog` the same field set. Releases nothing: the annotation is erased at build time (the emitted JS for `RecordDetailView.tsx` is byte-identical before and after), the handler is not exported, and no published surface changes.
