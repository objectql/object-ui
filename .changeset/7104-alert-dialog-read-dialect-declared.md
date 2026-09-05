---
'@object-ui/types': minor
---

`AlertDialogSchema` now declares the four keys the `alert-dialog` renderer actually reads
(objectui#7104): `content` (the dialog body, `SchemaNode | SchemaNode[]` like every sibling
overlay), `cancelText` and `actionText` (the footer's two button labels — each button renders
only when its label is set; there is no renderer default) on BOTH faces, and `onAction` (the
confirm button's click handler) as a RUNTIME SLOT in the objectui#6124 shape: callable on the
TypeScript face, refused by name in the zod mirror because JSON has no function value.

Until now none of the four was declared anywhere. They were accepted only through
`BaseSchema`'s `[key: string]: any` and the mirror's `.passthrough()` — no editor completed
them, no page named them, and a wrong-typed value rode through unexamined — while the keys
the type DID declare for the same affordance (`cancelLabel` / `confirmLabel` /
`confirmVariant`) are read by nothing, so a document written strictly against the shipped
type rendered an empty footer. The renderer's own registered `inputs` and `defaultProps` were
already written in the read dialect; this change makes that single de-facto contract legible
instead of minting a second one (AGENTS.md #0.1: one strict contract, not N dialects).

**Accept-set change on the published zod mirror — breaking, shipped as `minor` per this
repo's version-alignment policy (majors track `@objectstack`).** Declared keys are validated
even under `.passthrough()`, so three documents that parsed green yesterday are refused
today, each at its own path: `cancelText` or `actionText` carrying a non-string
(`cancelText: 123` — the renderer drew it as button text), `content` carrying a value that is
not a node or node array (an object without `type`), and `onAction` carried at all (a JSON
author cannot write a function; a string or object there was accepted and forwarded to the
button, where it did nothing or threw at click). A document in the read dialect with
well-typed values parses exactly as before and its values now survive the parse typed.
Undeclared keys still pass through unchanged. On the TypeScript face, `cancelText: 123` is
now a compile error at the key where the index signature used to absorb it.

**No renderer change; no runtime behaviour changes.** The `alert-dialog` renderer, its
`inputs` and its `defaultProps` are untouched. The three declared-but-unread keys are
deliberately NOT retired here — that is a narrowing with its own card and its own grade;
their per-key liveness readings are on objectui#7104.

Docs: `content/docs/components/overlay/alert-dialog.mdx` now publishes the read dialect in
its Schema block and no longer lists `actions?: BaseSchema[]`, a key no surface ever carried.
The four schema-catalog examples that page embeds still author `actions` and render an empty
footer — filed as objectui#7693, not converted here (the conversion is lossy).
