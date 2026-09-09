---
'@object-ui/core': patch
---

`validateSchema` takes `unknown` instead of `any`, and narrows the value before it reads a
key off it (objectui#8416). The published declaration moves by exactly one token —
`validateSchema(schema: any, path?: string)` becomes `validateSchema(schema: unknown,
path?: string)` — and no call site has to move with it: every value is assignable to
`unknown`, the function is not generic, and its return type is the concrete
`SchemaNodeValidationResult`, which names no parameter type. Nothing outside the package
needed a cast or an edit.

**The half that is not a type annotation: `validateSchema(null)` no longer throws.**
`validateSchema` calls four rules unconditionally and only one of them — `validateBaseSchema`
— ever checked that it had an object. `validateFormSchema` read `schema.type` and
`validateChildren` read `schema.children` regardless, so `validateSchema(null)` and
`validateSchema(undefined)` threw `TypeError: Cannot read properties of null (reading
'type')` instead of returning the `INVALID_SCHEMA` result the function's own contract
promises; `isValidSchema(null)` threw instead of answering the `false` its docblock
documents, and `assertValidSchema(null)` threw that `TypeError` in place of its own
`Schema validation failed:` refusal. The single guard now runs once, in `validateSchema`,
before any rule reads a key. The same one-level-down defect is closed with it: a `null`
entry inside a form's `fields` array threw the same `TypeError` and is now reported as
`MISSING_FIELD_NAME`.

**No verdict that already existed changes.** The guard's accept set is the one it replaces,
spelled the same way (`!value && typeof value !== 'object'` refuses `null`, `undefined` and
every primitive; arrays and plain objects pass), so an array node keeps its
`MISSING_REQUIRED`, a primitive keeps its single `INVALID_SCHEMA`, `null` holes inside
`children` are still skipped, and no new error `code` is emitted. A 29-case accept-set
matrix was diffed before and after: every difference is a value that used to THROW and now
returns a result. The one exception is a corner JSON cannot express — a *named function* as
a `fields` entry used to satisfy `field.name` through `Function.prototype.name` and now
reports `MISSING_FIELD_NAME`; function values on this mirror are already refused
(objectui#6124).
