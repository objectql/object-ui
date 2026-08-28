---
'@object-ui/app-shell': patch
---

Studio's metadata authoring path stops greeting the author with errors they did not cause, English help text in a Chinese console, and a toast on top of the publish button.

Three defects measured on a 17.1.0 dogfood walkthrough (objectui#5416), all on
the first surfaces a new author sees.

**Validation no longer runs on mount.** `新建软件包` opened with both required
fields already red: the create draft is `{ version, type }`, so
`ManifestSchema.safeParse` reported `name` and `id` missing on the very first
render, and the dialog then jumped a line height per field as each error
cleared. `SchemaForm` now defers the error *line* until the row has been
touched — first focusout anywhere in it, or the field's own first edit — for
create forms only. The rule itself did not move: `issues` still reaches the host
unchanged, so the submit button is gated on exactly the same validation, and
edit/view forms still report from mount, where the issues describe stored values
rather than something half-typed.

**The package form's help text is translated.** The labels came from the
metadata-admin i18n bundle and the help line under each one came straight from
`ManifestSchema`'s English `.describe()`, so a zh console rendered 显示名称 over
"Human-readable package name". `getPackageForm` now reads each field's help
through the same bundle as its label, via a new `tOptional` that returns
`undefined` rather than echoing the key back. Only zh entries exist: an en-US
console finds nothing and keeps falling through to the spec's own sentence, so
the English keeps exactly one producer — `@objectstack/spec` in the framework
repo — and this repo never holds a copy of it to drift.

**The publish panel's primary button opens clear of the toast stack.** The
console mounts its toaster bottom-right and `DraftChangesPanel` is a
`side="right"` sheet with an `mt-auto` footer, so a save toast raised on the way
there (`对象「…」已存为草稿`, 4s default) sat directly on 全部发布 until it timed
out. Opening the panel now clears the stack the surface the author just left had
raised. Repositioning the toaster was measured and rejected: the draft preview
bar is `sticky top-0` and carries its own publish actions, `NotificationSnackbar`
anchors bottom-centre and the nav rail owns the left edge, so a move only
relocates the same collision onto a different primary control.

Not fixed here, and not fixable here: the other strings the card names are
produced outside this repo. `Owning Business Unit` (`packages/spec`),
`Search Index` (`packages/objectql`) and the `Revise Window` flow node's name
and description (`packages/plugins/plugin-approvals`) all come from the
framework, which owns their translation catalogue; patching them in the console
would create a second source of truth that diverges at the next framework
release.
