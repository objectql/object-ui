---
"@object-ui/console": patch
---

The Public Forms dialog now refuses an out-of-contract `submitBehavior.url` at the moment it is authored, with the contract's own prescription shown next to the field (objectui#4990).

The redirect branch validated one thing — that the field was not empty — and wrote whatever else was typed into the view metadata. objectstack#7496 rules this key **relative-only** and refuses seven families of value; this door enforced the first. An admin could type `https://example.com/thanks`, or `javascript:alert(1)`, and be told nothing by the surface that had just taught them the value was acceptable — the field was `type="url"`, whose own notion of valid is an absolute URL, under a `https://example.com/thanks` placeholder.

What changed:

- **The save is refused, with the spec's sentence.** The verdict comes from `checkSubmitRedirectUrl`, the same `@objectstack/spec` `FormViewSchema` parse the renderer already asks at submit time — now exported from `submitRedirect` and called by the door. An absolute URL, a script or data scheme, a protocol-relative `//host`, a backslash, whitespace or a control character, a malformed `{{record.field_name}}` token, a document-relative path and an empty value each get their own author-facing prescription, naming the rule and what to write instead. The rule is not restated here: a second copy in the dialog would pass every value comparison right up to the release that moved the original, so a later widening of the ruling is followed by the pin rather than by an edit.
- **`Redirect URL is required` is gone.** Empty is one of the seven families, so it routes through the contract too and the author reads a sentence that says what a destination looks like.
- **The field no longer teaches the wrong value.** It is a plain text input with a `/thanks` placeholder, and a hint stating the rule — an in-app path, `{{record.field_name}}` interpolation, and the app navigation item that is declared for a deliberately external destination.

The saved value is the one the schema accepted, read back off the parse, so the door and the renderer cannot hold different opinions about a destination. `thank-you`'s `title` and `message` stay unvalidated deliberately: the spec declares both as free-form strings, so there is no contract for a door to state about them.

The server's own metadata gate already refused these bodies (`422 invalid_metadata` on `submitBehavior.url`, from the same schema), so this closes an error path rather than a silent-save hole: the correction now arrives in the field the admin can fix instead of as a failed round-trip.
