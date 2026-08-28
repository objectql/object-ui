---
---

Doc-only fix in `@object-ui/components`: `packages/components/src/renderers/complex/TIMELINE.md`
linked `../../examples/prototype/src/App.tsx` for "comprehensive examples of all
three timeline variants in action" — that example app was deleted whole in
`3aa84cee0` with no successor at the same path, and no gate had ever opened this
file, so the link sat dead with nothing to notice (objectui#4938). Repointed at
the interactive demo the docs site now serves for the same three variants
(`https://www.objectui.org/docs/plugins/plugin-timeline`).

No source or behaviour change; text only.
