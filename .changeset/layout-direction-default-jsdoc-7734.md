---
'@object-ui/types': patch
---

The published `@default` documentation on `FlexLayoutProps.direction` no longer states a value that only one of its two consumers applies. The member is declared once (objectui#6151) but `flex.tsx` reads `schema.direction || 'row'` while `stack.tsx` reads `schema.direction || 'col'` ("Default to column for Stack"), so the single `@default 'row'` was correct for `flex` and wrong for `stack` — whose own `defaultProps.direction` is `'col'`. The renderers are unchanged — they are the authority for what runs — so only the docblock moved: `direction` now names both consumers in prose, the same remedy objectui#7361 applied to the sibling `align`. `justify` is shared by the same two consumers and both read `|| 'start'`, so its tag is correct and stays: the criterion is a DIVERGENT shared member, not a shared one.
