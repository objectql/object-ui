---
'@object-ui/console': patch
---

The Applications page's search box no longer takes the page out on the first keystroke when an app carries a non-string label

`apps/console/src/pages/system/AppManagementPage.tsx` filtered on `(app.label || '').toLowerCase()`. `label` and `description` are `I18nLabel` in `AppSchema` — `string | Record< string, string >` in `@objectstack/spec` 17.0.0-rc.6 — so an authored non-string label is spec-legal metadata, and an object is **truthy**: the `|| ''` guard never fired for one, and `.toLowerCase()` received the object.

```
TypeError: (l || "").toLowerCase is not a function
```

That throw happened inside `filter` **during render**, so it took the whole page down rather than degrading search. It stayed invisible until someone typed, because `if (!searchQuery) return true` returns before either read — the page mounted perfectly with the very metadata that killed it one character later.

Both reads now go through the resolver the rows already render with: `appTitle` (the single display-name helper objectui#4307 introduced in this file) for the label, and the identical `resolveKeyedI18nLabel(…, t)` call the description paragraph makes. This is a repair to one page's filter, not a new capability — but it does make search match what the operator can actually see: for objectui's keyed label form it now matches the pack's answer rather than the authoring `defaultValue`, and it matches `app.name` wherever the row heading itself falls back to it.

Routing search through the render path also means it cannot drift out of step again. The inline locale map form (`{ en: 'Storefront', 'zh-CN': '店面' }`) is still resolved by neither path — the row heading falls back to the app name and search now matches on exactly that, instead of crashing on it — so when objectui#4163 widens the resolver, display and search gain the map form in the same commit.

No first-party app ships a non-string app label today, so this was reachable through authored metadata rather than live in the shipped examples; the crash is real for anyone who authored one, and `AppSchema` accepts it with a green parse.
