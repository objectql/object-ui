---
"@object-ui/fields": minor
---

Field widgets no longer spread renderer-only props — or arbitrary keys from a
field config — onto the DOM element they render (objectui#3291).

**Behaviour change:** an unknown key written on a field configuration (or on an
SDUI `field:*` node) stops becoming an HTML attribute on the rendered control.
Nothing reads those attributes, but they were serialized into the DOM, into
snapshots, and into anything scraping rendered markup.

## What was happening

Widgets forwarded their leftover props with a bare spread, so whatever a host
handed them became an attribute. Measured on a real form with a real widget:

```
<input placeholder="PH-f" zzcanary="CANARY-STR" zzcanaryobj="[object Object]"
       zzcanarynum="42" id="…" type="text" value="" name="f">
```

`zzcanaryobj="[object Object]"` is an ordinary extra key on the field config
being `String()`-ed onto an attribute. React 19 does not warn about any of it:
an all-lowercase unknown attribute is passed through in complete silence, which
is why this went unnoticed.

Eleven widgets carried a line that looked like it prevented exactly this:

```ts
const { inputType, ...domProps } = props as any;   // "Filter out non-DOM props"
```

`inputType` is already stripped by the form renderer before a widget sees it,
so that line filtered nothing — the comment actively misled. It is gone.

## What changed

- New `toDomProps(props)`, exported from `@object-ui/fields`. It keeps only
  what may legitimately become a DOM attribute and drops the rest.
- The 14 field widgets that spread onto a host element now go through it:
  `text`, `textarea`, `number`, `boolean`, `date`, `datetime`, `time`, `email`,
  `phone`, `url`, `password`, `currency`, `percent`, and `select`.

**It is a whitelist, not a list of keys to drop.** The largest leak source is
not any named renderer prop — it is the open tail of author-supplied keys. The
form renderer destructures a fixed set of known keys and forwards the rest
verbatim, and `SchemaRenderer` is wider still: it spreads the whole authored
node as props with no strip layer at all, so on that path a widget's own spread
is the only line of defence. A blacklist of today's renderer-only props would
pass every canary above and would not stop the next authored key either.

The forwarded set is the one `FieldWidgetComponentProps` already **declares**:
`id`, `name`, `autoFocus`, `tabIndex`, `onBlur`, `onFocus`, `onClick`,
`className`, `disabled`, plus `aria-*` and the `data-*` family. Until now that
was a type-level claim a widget could violate at runtime just by spreading;
`toDomProps` is its executable form.

Two compile-time assertions tie the helper to the declaration, and it is worth
being exact about which drift each one prevents:

- the contract's DOM pass-through block is now a named type
  (`FieldWidgetDomProps`), and **both directions are compiler-bound**:
  forwarding a key the contract does not declare fails to compile, and
  declaring a DOM key the helper does not forward fails to compile too. The
  second direction guards *declared but not delivered* — a key that
  type-checks, reads as supported, and silently never reaches the element. The
  leak test structurally cannot see that class of bug: it looks for attributes
  that arrive, not for ones that go missing.
- `className` and `disabled` are bound in the **forward direction only**. They
  are DOM-legal and are forwarded, but they live in the controlled-input block
  because widgets also interpret them, so they are deliberately outside
  `FieldWidgetDomProps`.

An HTML global attribute the contract does not declare (`role`, say) is no
longer forwarded. It only ever arrived through the open spread. If a field node
should be able to author one, declare it on `FieldWidgetComponentProps` and add
it to the whitelist — the fix belongs at the contract, not in a wider spread.

## Regression gate

A new contract test renders **every** registered field widget through **both**
hosts — the real form renderer and `SchemaRenderer` — and fails on any
attribute HTML does not define for that element. It walks real DOM attributes
rather than listening for React warnings (React 19 is silent for the exact case
that leaked), asserts a validation error genuinely rendered before scanning the
error variant, and calibrates its own judge against two fixtures: standard
markup that must produce zero findings, and planted fake attributes that must
all be found. A new widget type is covered automatically — the sweep is derived
from the widget registry, so adding one without covering it fails the test.
