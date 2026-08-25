---
'@object-ui/app-shell': patch
---

Pin `module` / `moduleResolution` to `nodenext` in `@object-ui/app-shell`'s build config, matching the pins `@object-ui/react`, `@object-ui/fields` and five other packages already carry. This package builds with a bare `tsc`, which never rewrites import specifiers, so what the source writes is exactly what `dist` ships; under `nodenext` a missing relative extension is a compile error, so the extensionless-specifier defect that made published entries unloadable under plain Node cannot come back silently here.

The lazy `@monaco-editor/react` imports in the metadata designer's source editors now read the package's named `Editor` export instead of its default. `@monaco-editor/react@4.7.0` is CommonJS and ships no `exports` map, so under `nodenext` the default resolves to the module namespace rather than to the component. The two names are one declaration in that package's own typings and the same object at runtime in both its CommonJS and ESM builds, so the editor that renders is unchanged.
