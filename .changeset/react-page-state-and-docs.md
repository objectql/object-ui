---
"@object-ui/react": patch
"@object-ui/react-runtime": minor
"@object-ui/types": minor
"@object-ui/components": patch
---

fix(sdui): a react page no longer loses its state to a memo that never held, and a source that exports nothing fails loudly

Writing the regression guard for objectui#2954's "latent hazard" found it was
already real.

**`evaluatedSchema` was memoised on values rebuilt every render.**
`SchemaRenderer` fell back to a fresh `{}` when no `SchemaRendererProvider` sat
above it, and `usePageVariables()` returned a brand-new object literal outside a
`PageVariablesProvider`. Both feed the `evaluatedSchema` memo's dependency list,
so for any tree without those providers the memo never hit: the schema was
re-cloned and the ExpressionEvaluator re-run on every render, and children got a
new schema identity every time. A `kind:'react'` page memoises its compiled
source on that identity, so the page was recompiled — a new page function, a new
element type — and React remounted it, silently discarding the user's `useState`.
Any registry notification (every lazy plugin's first load) triggered it. Both
fallbacks are now module constants.

**A source that exports nothing now throws instead of rendering blank.**
`generateElement` inserts the implicit `export default` only when the source
*starts with* JSX, a `function` declaration, `()` or `class` — so the very
common `const Page = () => …` exported nothing, and the page rendered blank with
no error reported anywhere. It now throws with a message naming the fix, which
`ReactRunner`'s error panel surfaces. `export default null` still means "render
nothing"; a default export that is not a component throws too.

**`PageSchema['kind']` matches `@objectstack/spec`.** It declared
`'full' | 'slotted'` while the renderer had shipped `'react'` and
`'html'`/`'jsx'` since ADR-0080 and read the field through a cast. The union now
spells all five and the cast is gone.

Docs: new `content/docs/guide/react-pages.md` (choosing between the executed and
parsed tiers, the capability gate, the injected scope, flat props, `Block`,
`useAdapter`, source shapes, error handling) and a `@object-ui/react-runtime`
README — the package had neither, while being the tier AI-authored pages target.
