---
---

Comment-only correction in `@object-ui/fields`. The `MULTI_VALUE_FORM_TYPES` docblock in
`field-type-alias.ts` asserted that every `MULTI_CAPABLE_TYPES` member other than `select`
renders both arities inside one widget, naming `LookupField`, `FileField` and `ImageField`
while silently omitting `radio` — which reads `multiple` nowhere, and so is the one member
with no multi-arity renderer. The docblock now states that exception, pins it to this repo's
own single-value contract for `radio`, and points at the producer-side work that refuses the
authored combination. No published behaviour changes.
