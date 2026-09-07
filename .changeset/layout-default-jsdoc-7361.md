---
'@object-ui/types': patch
---

The published `@default` documentation on two `layout.ts` members now matches the value the renderer actually applies. `ContainerSchema.maxWidth` documented `'lg'` while `container.tsx` applies `schema.maxWidth ?? 'xl'`, and the shared `FlexLayoutProps.align` documented `'center'` while `flex.tsx` applies `schema.align || 'start'` and `stack.tsx` applies `schema.align || 'stretch'`. The renderers are unchanged — they are the authority for what runs — so only the docblocks moved; `align` now states both consumers in prose instead of carrying a single `@default`, because one member shared by two deliberately divergent component types cannot have one correct default.
