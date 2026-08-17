---
'@object-ui/components': patch
'@object-ui/i18n': patch
---

The config panel footer translates: `ConfigPanelRenderer`'s Save / Discard labels come from the locale pack.

`saveLabel` and `discardLabel` carried the English literals `'Save'` and
`'Discard'` as parameter defaults, and no caller in the repo passes either prop,
so the sticky footer that appears the moment a config draft is dirty stayed
English in every locale — inside panels whose every other string had already
been routed through `t()`. The fix is in the renderer rather than per-caller:
the footer is the renderer's own chrome, so a caller-side fix would translate
one panel's footer and leave the next host's English.

Both labels now resolve through `createSafeTranslation` — the mechanism this
package already uses for its built-in copy in `form.tsx`,
`fullscreen-editor.tsx`, `data-table.tsx` and friends. An explicitly passed
`saveLabel` / `discardLabel` still wins, unchanged and untranslated.

`common.save` is reused rather than twinned: it already ships `Save` in all ten
packs and is what the console's other save buttons read. `common.discard` is
new, because the packs carried no shared spelling of the word — the three that
existed are each scoped to one surface (`form.discard`,
`console.settingsView.discard`, `console.objectView.discard`) and the last of
them diverges from the other two in zh/ko/fr. Its ten values are the majority
spelling, byte-identical to `form.discard` and `console.settingsView.discard`.

Both English defaults are byte-identical to the literals they replace, so a
host that mounts no `I18nProvider` renders exactly what it did before.
