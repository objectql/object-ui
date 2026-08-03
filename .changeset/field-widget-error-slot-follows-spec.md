---
"@object-ui/fields": minor
"@object-ui/components": minor
---

Field widgets are finally told when their field fails validation, and the props
slot that carries it takes the name the published contract gives it
(objectui#3222).

**Breaking** for anyone implementing a field widget (see migration below). The
repo version policy keeps this a `minor` — objectui's major tracks
`@objectstack`'s — so read the bump as "breaking within objectui".

## The a11y defect this fixes

`@objectstack/spec/ui`'s `FieldWidgetPropsSchema` — the published contract that
third-party and AI-authored field widgets are written against — has always
declared `error?: string`. `@object-ui/fields` declared its own slot as
`errorMessage`. That looked like a naming split; it was worse:

```
producers of `errorMessage` anywhere in packages/ + apps/ :  0
reads of `errorMessage` in packages/fields/src            : 15  (7 widgets)
reads of `props.error`                                    :  0
```

The slot was dead under BOTH spellings. No host ever passed it: the form
renderer showed validation text through its own `<FormMessage/>` and never
forwarded the prop. So `EmailField`, `CurrencyField`, `UrlField`,
`RichTextField`, `PercentField`, `TextAreaField` and `PhoneField` each computed
`aria-invalid={!!errorMessage}` from a value that was `undefined` forever —
**`aria-invalid` had never once been set, and a screen reader was never told
the field had failed validation.**

Worse than "never set": `<FormControl>` is a Radix `Slot` that hands its child a
CORRECT `aria-invalid`, but a widget's own attribute is written after the props
spread, so it wins. Those seven widgets were actively overwriting the right
answer with `false`.

FROM: `renderFieldComponent` received no validation state, and the widget props
type declared `errorMessage?: string`, which nothing produced.
TO: the form renderer passes react-hook-form's `fieldState.error?.message` down
as `error` when it renders a registered widget, and the props type declares
`error?: string`. Both ends of the contract are live for the first time; a
rename alone would only have swapped one dead key for another.

## Migration for widget authors

```diff
-export function MyField({ value, onChange, field, readonly, errorMessage }: FieldWidgetComponentProps< string >) {
-  return <Input value={value} aria-invalid={!!errorMessage} />;
+export function MyField({ value, onChange, field, readonly, error }: FieldWidgetComponentProps< string >) {
+  return <Input value={value} aria-invalid={!!error} />;
```

No alias is kept. `errorMessage` was retained nowhere on purpose — a tolerant
second spelling is exactly the de-facto second contract AGENTS.md #0.1 forbids,
and it is what would let a missed call site go quiet again. Because
objectui#3221 had already removed the type's `[key: string]: any`, every missed
site is a compile error rather than a silent `any`, so the compiler — not grep
— validated this rename.

## Responsibilities are split, not duplicated

The widget consumes `error` **only** to drive `aria-invalid` on the control it
renders (which only it can do — `aria-invalid` has to sit on the input element).
The message TEXT stays with `<FormMessage/>` in the form renderer. A widget that
also renders the text double-displays it, and the docs, the agent prompt and the
tests all now say so.

For the same reason `required` — also declared by the spec, also never delivered
— is deliberately NOT lowered into widget props: the required marker has exactly
one author, the renderer's `<FormLabel>`, and giving widgets the flag invites a
second asterisk. The a11y state a widget could legitimately carry is
`aria-required`, which needs no contract change at all (`AriaAttributes` is
already part of the type and widgets already forward it).

Builtin field types are unaffected: they render inside `<FormControl>`, whose
Slot already supplies `aria-invalid`, so `error` is stripped there rather than
leaking into the DOM as a stray attribute.

Docs updated to match: `content/docs/guide/plugin-development.md`,
`skills/objectui/guides/plugin-development.md` and
`.github/prompts/component.prompt.md` — the last of which additionally used the
spec's non-generic type alias as a generic (`FieldWidgetProps< number >`) and
destructured a `mode` prop that exists on neither type.
