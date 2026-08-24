---
'@object-ui/i18n': patch
---

The Spanish pack renders `Done` as `Listo` at every one of the four sites that say it
(objectui#3880, triage adjudication 2026-08-09). `grid.bulk.done` — the footer button that
dismisses the bulk-action result dialog — read `Hecho` while `common.done`, `view.done` and
`form.fullscreen.done` all read `Listo`, so the same English word rendered two ways in
Spanish across dialogs a user meets in one session.

Adjudicated a typo rather than a deliberate contextual split, on three checks. All four
keys hold the byte-identical `en` value `Done`, and all four call sites are the same
control: a dialog-footer button whose click finishes or dismisses the surface
(`BulkActionDialog` `onClose(result)`, `ManageViewsDialog` `onOpenChange(false)`,
`fullscreen-editor` `commitFullscreen`, `InviteMemberDialog`'s invitation-created footer).
The nine other packs each render all four identically (de `Fertig`, fr `Terminé`, pt
`Concluído`, ru `Готово`, ja `完了`, ko `완료`, zh `完成`, ar `تم`), so no other translation
pass had found a context worth splitting on. And the neighbouring `Hecho`/`Deshecho`
pairing that could have justified it does not hold: `grid.bulk.undo` is the verb `Deshacer`,
and `Deshecho: ` is `undonePrefix`, a result-line status rather than a button.

`Hecho` moved to the 3:1 majority `Listo`, which is the value objectui#3546 slice seven had
already chosen for `common.done`. `packages/i18n/src/__tests__/residue-namespaces-3546.test.tsx`
pinned the old outlier as a recorded example of deliberate divergence; that pin now asserts
the four as one value instead, and its note keeps the history plus the `Pending`/zh row,
which remains a genuine deliberate split.

No `en` value changes, so no other pack is asked to follow. This is the value half of
objectui#3880 only — the card's 281/164 shared-string census stays on the card as
documentation, and is explicitly not a gate: 164 of those groups diverge legitimately.
