---
"@object-ui/react": patch
---

Fix `createLazyPlugin`'s JSDoc example, which taught a call that does not compile.

The `@example` block passed `() => import('@object-ui/plugin-grid')` as the
`importFn`. ObjectUI plugin packages export their components by name and have no
`default`, so that call supplies the module namespace object — rejected by the
compiler (`Property 'default' is missing`) and, at runtime, handed to
`React.lazy` as the component. The examples now unwrap the named export via the
`async` spelling, which is the form that actually type-checks. This ships in the
published `.d.ts`, so it is what editors show on hover.
