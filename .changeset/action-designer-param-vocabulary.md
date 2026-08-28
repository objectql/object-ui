---
"@object-ui/app-shell": patch
---

fix(app-shell): the Action designer's preview draws what the runtime dialog will draw

`ActionDefaultInspector` offers eight param `type` spellings; `ActionPreview`'s
dialog mock switched on five of them over a private table, so three of the eight
previewed as a control `ActionParamDialog` does not render — `datetime` and a
targeted `lookup` as plain text boxes, and a `select` whose options were not
authored yet as a text box as well. A `text` param that happened to carry
`options` previewed as a select the runtime never draws, for the same reason in
the other direction.

The mock now resolves each param through `paramToField`'s
`resolveParamWidgetType` / `paramDegradesWithoutTarget` — the same adapter the
dialog itself renders through — so the two panes cannot disagree about a
spelling again. `datetime` draws a date/time control, a `lookup` with a declared
`reference` draws a record picker, a targetless one draws the record-id text box
the dialog degrades to and says why, and a `select` always draws a picker.

The per-param editor also gains an `options` control for `select` params. It had
none, and `params` is hidden from the collapsed "More fields" form, so the panel
that offered the type had nowhere to author the choices the type needs.
