---
'@object-ui/i18n': minor
---

Retire `useObjectLabel().viewDescription()` and the `_views.<view>.description`
catalog convention it resolved (objectui#7219, maintainer ruling 2026-09-02,
option B — enforce-or-remove).

**Breaking for translation bundles, deliberately — and this text is the notice.**
Out-of-repo translation bundles that authored
`<ns>.objects.<objectName>._views.<viewName>.description` cannot be seen from
this repo, so there is no census to point at and no migration script to run:
that key now resolves nowhere, and an entry left under it is simply ignored.
Nothing throws, and nothing else on that node changes.

**What replaces it.** A list view's description has exactly ONE channel: the
`I18nLabel` value authored on the view entry itself — a string, or an inline
locale map:

```ts
listViews: {
  by_unit: {
    label: 'By business unit',
    description: { en: 'Open work only.', 'zh-CN': '仅未完成的工作。' },
  },
}
```

`ObjectView` relays that value to the renderer and `plugin-list`'s `ListView`
resolves it against the display locale (objectui#7199, shipped before this
change), so the authored channel already works end to end. **Migration:** move
the sentence out of the translation bundle and onto the view entry as a locale
map.

**Why removed rather than wired in.** The member was declared and resolved but
had zero callers and zero in-repo bundle usage — an entry authored under the
catalog key reached no screen. Wiring it in would have put two vocabularies on
one concept (`I18nLabel` on the entry, and the catalog key) and required a
precedence rule between them, which is the ambiguity rather than the fix.

The two sibling members on the same node are **unaffected**: `viewLabel` and
`viewEmptyState` still resolve `_views.<view>.label` and
`_views.<view>.emptyState.{title,message}`, and the shared `viewSuffixes` key
builder they use is unchanged — only the `'description'` tail is gone. Pin tests
in `@object-ui/i18n` and `@object-ui/app-shell` were retargeted onto those two
survivors plus a case that authors the catalog `description` and asserts the
authored value is what a consumer resolves.
