---
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-grid': patch
---

A gantt task titled `A$&B` no longer prints `{{title}}` back into its own delete dialog — the two hand-rolled provider-less fallback interpolators are literal, like i18next

objectui#3418 fixed the shared helper's fallback interpolator: `String.prototype.replace` became `split(needle).join(value)`, because `replace` and `replaceAll` both interpret `$&`, `` $` ``, `$'` and `$$` in the **replacement** string and i18next does not. Two hand-rolled copies of that interpolator never got the fix. Both are deliberate non-users of `createSafeTranslation` — each falls back per key so a host dictionary that covers the common keys but lags on newer ones still resolves what it has — so the shared fix had no path to reach them.

The reachable one is gantt's. `gantt.delete.body` is `'"{{title}}" will be permanently removed. …'` and its call site interpolates the record's own title, which is user data:

| task title | rendered before | rendered now |
|---|---|---|
| `A$&B` | `"A{{title}}B" will be permanently removed.` | `"A$&B" will be permanently removed.` |
| ``x$`y`` | `"x"y" will be permanently removed.` | ``"x$`y" will be permanently removed.`` |
| `p$$q` | `"p$q" will be permanently removed.` | `"p$$q" will be permanently removed.` |
| `u$'v` | `"u" will be permanently removed. …v" will be permanently removed. …` | `"u$'v" will be permanently removed.` |

The first row is the ugly one: `$&` expands to the matched text, so the placeholder itself is printed back to the user inside the record's own name. Gantt's copy also carried the other half of the same defect — a bare string needle substitutes only the **first** occurrence, where i18next substitutes every one — and `split`/`join` fixes both at once.

The import wizard's copy used a `g`-flagged `RegExp`, which covered the repeated-placeholder half but could not touch the `$`-pattern half: that harm lives in the replacement string, not the needle. Its values are authored metadata — field labels and type names spliced into `grid.import.missingRequiredHint` and `grid.import.legacyReferenceBlocked` — so a label containing `$&` corrupted the hint the same way. Retiring the `RegExp` also retires an unescaped needle, since the placeholder name went into the pattern uninterpolated; that was inert while every placeholder name is a bare identifier, and is now structurally impossible.

This is the provider-less path only (standalone embedding, unit tests). With an `I18nProvider` mounted, i18next serves these keys and was already literal on both sides — which is exactly why the divergence was invisible. No pack, key or call site changed; the three `{{count}}` gantt keys take numbers and were never affected, and `gantt.quickFilter.resultSummary`'s deliberate single-brace idiom is resolved by its call site rather than this interpolator and is untouched.
