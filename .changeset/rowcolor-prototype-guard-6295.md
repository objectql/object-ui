---
'@object-ui/plugin-grid': patch
---

Guard `useRowColor`'s two object-literal lookups with `Object.prototype.hasOwnProperty.call`.

Both `config.colors` (the authored map) and the module's `COLOR_TO_CLASS` literal inherit
`Object.prototype`, and both were reached with a bare index. A record whose colour field
held `constructor`, `toString`, `valueOf` or `hasOwnProperty` resolved to an inherited
function: the `if (!color)` guard passed it (functions are truthy) and `colorToClass` then
called `.startsWith` on it, throwing a `TypeError` inside the row-className resolver during
render — a grid crash triggered by record data rather than by metadata. The same shape one
call deeper in `colorToClass` did not throw; it handed an `Object.prototype` member back as
the row's `className`, which reached React as a class attribute. Both now resolve to
`undefined`, as an undeclared value always did.
