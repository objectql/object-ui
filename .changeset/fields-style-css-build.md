---
'@object-ui/fields': minor
---

Build and publish `@object-ui/fields/style.css` — the subpath the package has always declared and never shipped

`packages/fields/package.json` has declared `"./style.css": "./dist/index.css"` for the package's entire life, while its build was `tsc && vite build` and the package contained no `.css` file for Vite to extract. **No published version up to and including 17.3.0 contains a stylesheet** — the `@object-ui/fields@17.3.0` tarball has zero `.css` files in it. The subpath did not merely render badly, it failed to resolve: a consumer writing the `@import '@object-ui/fields/style.css'` that the quick-start guide taught got a build error. This release is the first one where that import works, so it is a new capability rather than a repair of a working one, and no existing consumer can be relying on the old behaviour — an import that never resolved has no working callers.

Removing the export was the cheaper option and was rejected on a measurement: fields' class surface is not a subset of what `@object-ui/components` publishes. 155 classes exist only here, and 17 of them (`hover:bg-accent/30`, `ring-destructive/50`, `bg-primary/20`, …) resolve `@theme` tokens declared in unpublished package source, so no consumer-side Tailwind configuration can generate them. Dropping the export would have made the field widgets permanently under-styled with no supported remedy.

The new sheet is a **supplement, not a replacement** — it is compiled against the components theme and then has every rule that package's sheet already ships subtracted from it, so it is ~22 kB rather than another ~180 kB of near-duplicate CSS. Import it after the components sheet:

```css
@import 'tailwindcss';
@import '@object-ui/components/style.css';
@import '@object-ui/fields/style.css';
```

Also adds a workspace-wide guard (`scripts/__tests__/package-files-exist.test.ts`) that fails when any package exports a subpath its published tarball cannot contain, so a stylesheet export with nothing building it cannot recur silently.
