---
'@object-ui/components': minor
'@object-ui/fields': patch
---

The fullscreen long-text dialog announces the field's validation state and carries the field's name

objectui#4824, objectui#4832.

`mobile.fullscreenLongText` is a shipped opt-in, and with it on the phone user
edits long text in this dialog and nowhere else. Measured on all three surfaces
that render the dialog — `TextAreaField`, `RichTextField`, and the form
renderer's built-in `textarea` branch — with the field genuinely invalid at that
moment:

```
INLINE  richtext  aria-invalid= true
DIALOG  richtext  aria-invalid= false   aria-describedby= null
INLINE  textarea  aria-invalid= true
DIALOG  textarea  aria-invalid= null    aria-describedby= null
```

and the accessible name of every dialog control empty, against `F` on every
inline one. The rich-text row is the sharp half: the dialog was not silent about
the failure, it was announcing the OPPOSITE of the inline control for the same
field at the same moment, because `RichTextEditorSurface` computed
`aria-invalid={!!error}` from an `error` prop the dialog rendering never
received. 3 surfaces, 3 broken, one cause: the dialog's control is built from
scratch by the host, so none of the wiring the inline control gets from the form
renderer reaches it.

**Answered once, in the primitive.** `FullscreenEditor` now takes the field's
`error` and owns what the dialog does with it: it renders the message in a
dialog-local node, and hands `children` a required fourth argument — a
spreadable set of DOM attributes — carrying `aria-labelledby` (the dialog
title's text, i.e. the field label #3393 already put there), `aria-invalid`, and
`aria-errormessage` naming that node. The host spreads it; the host never learns
an id, so it cannot name the wrong node, cannot compose the attributes subtly
wrong, and cannot compute its own `aria-invalid` from a prop it forgot to plumb.
Three hosts hand-answering this is the shape that produced three identical
holes.

**On objectui#3222's "the text belongs to `FormMessage`".** The maintainer's
ruling of 2026-08-16 restates that rule as what it was always protecting —
only one copy of the error text is in the accessibility tree at any moment —
which the dialog-local node satisfies: it exists only while the dialog is open,
and for exactly that window Radix `aria-hidden`s everything outside the modal,
`FormMessage` included. The shortcut of pointing the dialog control's
`aria-describedby` / `aria-errormessage` at the host's `FormMessage` id is
forbidden rather than merely unused: it resolves to a node that is `aria-hidden`
for the whole time the reference is live (an ARIA MUST violation), and neither
happy-dom nor jsdom can see the difference — which is why every new pin asserts
that the named node is inside THIS dialog, not merely that it exists.

`aria-errormessage` carries a single IDREF and is emitted only alongside
`aria-invalid="true"`. It is deliberately not folded into the host's
`aria-describedby` chain, which on the textarea surface already carries the
fullscreen character counter's sentence.

**The name reuses the visible title rather than minting a second author for it**
(#3978): `aria-labelledby` points at a span inside `DialogTitle`, not at
`DialogTitle` itself — Radix renders the title as `h2` with the id its own
`DialogContent` `aria-labelledby` names, so putting an id on it would buy the
control a name at the cost of the dialog's.

**Breaking (shipped as `minor`, see below), `@object-ui/components` only.**
`FullscreenEditorProps.error` is REQUIRED, not optional, and
`FullscreenEditorProps['children']` takes a fourth argument.

FROM → TO for an out-of-repo host:

```
<FullscreenEditor value={v} onCommit={c} label={l} testIdPrefix="x">
  {(draft, setDraft, disabled) => <textarea … />}
</FullscreenEditor>

<FullscreenEditor value={v} onCommit={c} label={l} testIdPrefix="x" error={err}>
  {(draft, setDraft, disabled, aria) => <textarea {...aria} … />}
</FullscreenEditor>
```

A render prop may still declare fewer parameters, so only `error` fails to
compile — which is the point of making it required. Every consumer already has
the value at hand (registered widgets take `error` off the widget props
contract, objectui#3222; the built-in branch reads `fieldState.error?.message`),
and an omitted `error` reproduces this defect exactly: a dialog announcing
`aria-invalid="false"` for a field its own form has already failed. An optional
key was forgotten by three surfaces in a row; a required one cannot be.

`@object-ui/fields` is `patch`: `FullscreenFieldEditor` is internal to that
package (not re-exported from its entry), so nothing in its public surface
changes — only the behaviour of the two long-text widgets' dialogs.

`minor` rather than `major` follows the repo's standing retirement precedent
(AGENTS.md §版本号策略, enforced by `scripts/check-changeset-no-major.mjs`): all
publishable packages sit in one `fixed` group, so a `major` here would carry the
whole family up against an `@objectstack` that has not moved.
