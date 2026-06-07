---
"@object-ui/app-shell": minor
---

Studio: new record pages seed their layout from the object's default detail page.

Creating a `pageType: 'record'` page bound to an object previously started from a blank canvas. The `page` resource now has a `createSeed` hook that, on create, fetches the bound object and seeds the page's `regions` from `buildDefaultPageSchema(objectDef)` — the same auto-generated detail layout the runtime renders by default. Authors start by tweaking the default page, not rebuilding it. A generic async `createSeed` hook was added to `MetadataResourceConfig` (merged into the create body after `createBuildBody`/`createDefaults`; best-effort). Completes #1541's Studio authoring path.
