---
---

Comment-only truthfulness fix in `@object-ui/plugin-detail`'s spec-parity tests. The
`relationshipValueField` block in `recordRelatedListInputs.spec-parity.test.ts` and the
`hideFields` block in `recordDetailsInputs.spec-parity.test.ts` each narrated strip mode
as a present-tense fact about the installed `@objectstack/spec` — that an undeclared
top-level key parses green and is silently dropped from `data`. The props schemas were
closed upstream, so an undeclared key now draws a named `unrecognized_keys` refusal, and
both comments read as current while being false against the installed pin. Both now state
the pin-independent verdict (an undeclared top-level key is never authoring surface) and
note that the contract expresses it two ways depending on the installed pin, pointing at
`specRefusesUnknownTopLevelKeys` in the sibling `recordHighlightsInputs.spec-parity.test.ts`
as the behavioural probe. This also settles `recordDetailsInputs` disagreeing with itself,
its section-key block having already taken the pin-aware disposition. No assertion changed
and no published behaviour changes.
