---
'@object-ui/plugin-chatbot': patch
---

`parseAiQuotaError` now reads the AI quota refusal code from all three shapes the
cloud 429 producers use, instead of only the flat `error`-holds-the-code dialect.

The two live producers fill the same `error` key in opposite ways — the token
guardrail puts the **code** there, `service-ai` puts the **message** there and the
code in a `code` sibling — while ADR-0112 declares a third shape both are
converging on: `{ success: false, error: { code, message } }`. The consumer had to
learn the declared shape **first**, or the producers' convergence would silently
turn every quota refusal back into a generic "Response failed" banner (the same
consumer-first sequencing as objectui#2992).

- Code lookup order is a total order — declared envelope, then the flat guardrail
  code, then the `code` sibling — so a transitional producer that double-emits the
  new envelope alongside the legacy top-level keys has one defined outcome.
- Only the code's **location** widens. The recognized code set is unchanged, and
  any unrecognized shape still degrades to today's behavior (`null`), so no
  non-quota error is newly captured by the quota CTA.
- Companion fields (`upgrade`, `topUp`, `messageEn`) keep their established
  top-level read; their position inside the declared envelope is deliberately not
  presumed, and is aligned once the producer PR fixes the real shape.
