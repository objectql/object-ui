---
'@object-ui/plugin-view': patch
'@object-ui/i18n': patch
---

Localize the create / edit / view form title `ObjectView` builds itself
(objectui#3462)

The same family as #3426 / PR #3457 and #3459 / PR #3464, one call site further
in. `ObjectView.getFormTitle()` string-built its three verbs in TypeScript:

    case 'create': return `Create ${objectLabel}`;
    case 'edit':   return `Edit ${objectLabel}`;
    case 'view':   return `View ${objectLabel}`;

so a Chinese session whose object is labelled 联系人 read a drawer headed
**"View 联系人"** — an English verb glued onto a localized label. All three
consumers are visible chrome: `renderDrawerForm`'s `DrawerTitle`,
`renderModalForm`'s `DialogTitle`, and the `title` prop handed to
`NavigationOverlay` in the `popover` branch (a host-supplied `title` displaces
the overlay's own `resolvedTitle` default, so it is what the user sees).

The bar to reach it is lower than #3459's split panel: `ObjectViewSchema.layout`
already defaults to `'drawer'`, and `navigation` is a declared authorable input
on the registered `object-view` block whose `mode` union carries `drawer`,
`modal` and `popover`. A row click under any of them sets `formMode: 'view'` and
opens the container. `app-shell`'s wrapper pinning `layout: 'page'` is one host
overriding a registered block, not proof the branch is dead.

## What changed

The three verb branches resolve `form.createTitle` / `form.editTitle` /
`form.viewTitle`.

**No new key family was minted.** `form.createTitle` (`'Create {{object}}'`) and
`form.editTitle` (`'Edit {{object}}'`) already ship in all ten packs and are
already how `app-shell` heads the PAGE-mode record form
(`RecordFormPage.tsx`, `AppContent.tsx`). The drawer / modal / popover titles are
the same heading on a different surface, so they resolve the same keys — a
parallel per-plugin family would have guaranteed the two spellings drift, which
is what the sibling issues were about. Only the third verb had no sibling:
`form.viewTitle` is added to all ten packs, following each pack's existing
arrangement for its create/edit twins rather than a translated-verb-plus-label
concatenation (de puts the verb last, ja/zh use particles and no space).

`VIEW_DEFAULT_TRANSLATIONS` in `ObjectView.tsx` gains the three English entries,
which is what `createSafeTranslation` falls back to with no `I18nProvider`
mounted.

Two branches stay literal on purpose and are pinned by tests: `schema.form.title`
(the author wrote a title, so the author's title wins, in every locale) and the
`default` branch (bare object label, no verb to translate).

## Visible English change

None. Every branch is byte-identical in English — `Create Contacts`,
`Edit Contacts`, `View Contacts` — with and without a provider, so e2e specs and
host tests that address this chrome by its English name keep addressing it. The
provider-less path has its own test file, kept separate because
`initReactI18next` registers its instance as a module global that outlives
`cleanup()`.

The toolbar's create BUTTON keeps resolving `console.objectView.new`
("New" / 新建) and was deliberately not reused for the heading: a button verb and
a title are different contexts, and folding them together is how the next drift
of this shape would start.
