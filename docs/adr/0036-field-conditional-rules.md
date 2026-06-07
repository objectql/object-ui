# ADR-0036: Field-level conditional rules (visibleWhen / readonlyWhen / requiredWhen)

**Status**: Accepted — implementing (2026-06-07)
**Author**: ObjectUI renderer team
**Consumers**: `@object-ui/core`, `@object-ui/components` (form renderer), `@object-ui/plugin-form`, `@objectstack/spec`, `@objectstack/objectql`, every app whose forms need a field to appear / lock / become mandatory based on other field values

---

## TL;DR

A field's visibility, read-only state, and required-ness are frequently
**conditional on the rest of the record**: an invoice's `paid_on` is only
relevant once `status == 'paid'`; its `tax_rate` is locked once paid; a "send"
flow requires `issued_on` only when the invoice leaves draft. These are not
widget concerns — they are **data-model rules**, authored once on the field and
honored everywhere the object is edited.

We express them as three optional CEL predicates on `Field`:

| Prop           | When the predicate is TRUE                          | Enforced on        |
| -------------- | --------------------------------------------------- | ------------------ |
| `visibleWhen`  | the field is shown (else hidden)                    | client (UX only)   |
| `readonlyWhen` | the field is read-only                              | **client + server**|
| `requiredWhen` | the field is required                               | **client + server**|

`conditionalRequired` is a back-compat **alias of `requiredWhen`**.

## Why CEL, and why the *same* engine on both ends

The whole point of a dual-side rule is that the **client UX and the persisted
server verdict agree** for any given record. To guarantee that, both ends
evaluate the predicate with the canonical ObjectStack expression engine —
`@objectstack/formula`'s `ExpressionEngine` (CEL via `@marcbachmann/cel-js`) —
rather than a parallel evaluator. Same dialect, same stdlib, same null/missing
semantics. The alternative (a bespoke client-side condition DSL) is exactly the
drift hazard this avoids: it would agree on `record.status == 'paid'` today and
silently diverge the first time a predicate used `has()`, a string function, or
a list membership test.

`@objectstack/formula` is browser-safe — its only deps are
`@marcbachmann/cel-js` and `@objectstack/spec`, and `@object-ui/core` already
depends on the latter — so there is no new runtime surface and no node-only
import dragged into the bundle.

## Server enforcement (framework)

- **`requiredWhen`** — `@objectstack/objectql`'s rule-validator evaluates the
  predicate over the *merged* record (`{ ...previous, ...patch }`) and pushes a
  `{ field, code: 'required' }` violation when it is TRUE and the value is
  missing. `conditionalRequired` is treated identically.
- **`readonlyWhen`** — `stripReadonlyWhenFields` drops any field from an UPDATE
  payload whose predicate is TRUE for the merged record: the incoming change is
  **ignored** (the persisted value is kept), not rejected. Update paths fetch
  the prior record only when an object actually declares conditional fields
  (`needsPriorRecord`).
- A predicate that fails to evaluate is **fail-open** and logged (a broken rule
  must never block a legitimate write).
- `visibleWhen` is **not** a server concept — visibility is purely a client UX
  affordance. The server's `requiredWhen` / `readonlyWhen` are the real guards,
  so hiding a field client-side never weakens enforcement.

## Client enforcement (objectui)

- **`@object-ui/core`** exposes two zero-React helpers:
  - `evalFieldPredicate(pred, record, fallback, previous?)` — wraps the engine,
    returns `fallback` on an absent/broken predicate.
  - `resolveFieldRuleState(rules, record, statics, previous?)` → `{ visible,
    readonly, required }`. A static `required: true` / `readonly: true` is a
    **floor** — a FALSE predicate never weakens it; `visibleWhen` is
    authoritative when present.
- **The form renderer** (`@object-ui/components`) watches the live record
  (`form.watch()`) and re-evaluates every field's rules **reactively** as the
  user types. A field whose `visibleWhen` is FALSE is not rendered; `readonly`
  feeds the field's `disabled`; `required` drives both the asterisk and the RHF
  validation rule.
- **`ObjectForm`** (`@object-ui/plugin-form`) carries the three props through
  from object metadata onto the generated `FormField`s.

### The missing-key gotcha

CEL **throws** on a *missing* map key (`record.status` when `status` isn't in
the record) but compares cleanly against `null`. On a fresh create form,
react-hook-form hasn't registered every field yet, so a naïve `form.watch()`
omits them — and a `visibleWhen` referencing an unregistered field would fault
and fail *open* (flash visible). The renderer therefore seeds every declared
field to `null` before overlaying the *defined* watched values, so an
unregistered field reads as present-null (clean predicate result) rather than
missing (fault). This mirrors the server, which always evaluates over the full
merged record.

`evalFieldPredicate`'s fallbacks are chosen so a fault is *safe*: `true` for
visibility (don't hide content on error), `false` for required/readonly (don't
block submit or lock a field on error) — the same posture as the server.

## Showcase

`showcase_invoice` demonstrates all three:

```ts
issued_on: Field.date({ requiredWhen: "record.status in ['sent', 'paid']" }),
tax_rate:  Field.number({ readonlyWhen: "record.status == 'paid'" }),
paid_on:   Field.date({
  visibleWhen:  "record.status == 'paid'",   // UX-only: hide until paid
  requiredWhen: "record.status == 'paid'",   // dual-side
}),
```

Covered by the `field-conditional-rules` live e2e (drives Status →
paid/sent/draft and asserts each dependent field re-gates).

## Consequences

- Authors express conditional UX once, on the field, in the same CEL they
  already use for validation rules and formulas — no widget-level wiring.
- Client and server cannot drift: identical engine, identical dialect.
- `visibleWhen` is intentionally client-only; never rely on it for security —
  use `readonlyWhen` / `requiredWhen` (or a full validation rule) for guarantees.
