---
'@object-ui/types': minor
---

The zod `BaseSchema` mirror now accepts everything its TypeScript declaration
declares — five keys had drifted narrower (objectui#4605).

`@object-ui/types/zod` is a published runtime validator hand-written to mirror the
`BaseSchema` interface. As the interface widened, the mirror did not, so five keys
refused at parse time a spelling the published types invite and the renderer
implements — "declared = enforced" inverted. `.passthrough()` rescued none of them:
passthrough admits UNDECLARED keys, and all five are explicitly declared, so the
narrow declaration won.

Measured against the unmodified mirror before the change, these were the refusals:

| key | authored input | old mirror said |
|---|---|---|
| `visible` | `'${data.status === "open"}'` | `expected boolean, received string` |
| `disabled` | `'${data.status === "locked"}'` | `expected boolean, received string` |
| `ariaLabel` | `{ key, defaultValue }` | `expected string, received object` |
| `label` | `{ en: 'Owner', 'zh-CN': '负责人' }` | `expected string, received object` |
| `description` | `{ en: 'The record owner' }` | `expected string, received object` |

`visible`/`disabled` now take `boolean | string` — what `evaluateCondition` accepts,
no wider. `ariaLabel` takes the KEYED reference through a new exported
`KeyedI18nLabelSchema`; `label`/`description` take the spec's own `I18nLabelSchema`
BY REFERENCE, so a change to the spec's label contract is picked up rather than
re-typed. Every spelling that parsed before still parses.

The two i18n vocabularies are kept apart rather than merged into "some object".
`label`/`description` are the spec's INLINE locale map (resolved by
`resolveI18nLabel(label, locale)`); `ariaLabel` is the KEYED reference (resolved by
`resolveKeyedI18nLabel`, which returns `undefined` for a locale map and would render
an EMPTY aria-label). Widening both slots to accept either shape would have
reproduced objectui#4167's confusability hazard inside the validator that exists to
catch it, so each slot admits only its own vocabulary and both cross pairings are
pinned as rejections.

The new pin is DERIVED rather than a hand-written key list: it reads the mirror's own
`.shape` and compares each key against the declaration, so the next widening of
`base.ts` that forgets this file turns it red with no list to maintain. It reads
`.shape` and not `keyof z.input<…>` because that spelling was measured vacuous —
`.passthrough()` collapses the inferred key union to bare `string`, and a pin written
over it resolved `never` while five keys were demonstrably narrow. Two guards pin the
derivation against both degenerations (`never` and `string`).
