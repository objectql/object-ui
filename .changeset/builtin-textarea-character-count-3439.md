---
'@object-ui/components': patch
'@object-ui/fields': patch
---

The form renderer's built-in `textarea` branch now honours a declared character cap the same way the registered `field:textarea` widget does.

One `maxLength` declaration produced two experiences. The registered path has
shipped four things since objectui#3406/#3408/#3417 — the native cap, visible
`{n}/{max}` digits, a description reached through `aria-describedby` so the
limit is announced on focus, and a threshold-gated debounced near-limit notice.
The built-in branch — the path standalone and embedded hosts take, the ones that
call no `registerAllFields()` — shipped a subset of one of them.

The accessibility half is the half that mattered: a screen-reader user on this
path learned the field's limit only as a validation error AFTER submitting. All
four affordances now render on both of the branch's surfaces (the inline control
and the fullscreen dialog), from the SAME `CharacterCount` component the widget
renders rather than a second copy of it.

Also fixed, and wider than the visible gap: the branch never READ the cap, it
only spread its leftover field props onto the element. A camelCase `maxLength`
therefore worked by coincidence — it names a real DOM attribute — while the
legacy `max_length` spelling, which the registered widget and all three
producers of a form field have dual-read since framework#1878 §3, landed as a
stray inert `max_length="…"` attribute and capped nothing at all. The branch now
resolves both spellings and keeps the non-attribute spelling off the DOM.

`CharacterCount` moved from `@object-ui/fields` to `@object-ui/components`, the
package both render paths may import, in the direction and for the reason
objectui#3398 measured for `FullscreenEditor`. It was internal to `fields` (never
exported from that package's barrel), so no published export changed; it is a
new export of `@object-ui/components`. Its copy moved with it onto the same
`fields.textarea.*` keys with byte-identical English defaults, so the ten locale
packs need no edit and provider-less rendering is unchanged.
