---
'@object-ui/components': patch
---

A `field:`-prefixed `password` no longer renders as clear text when its widget is not registered

On the built-in path (`@object-ui/fields` not registered) a form field spelled with the
`field:`-prefixed widget id resolved nothing and took the form renderer's `default` input
branch. That branch's native-input table was keyed on the raw `type`, so the prefixed
spelling missed it and rendered `type="text"` — and `mapFieldTypeToFormType` emits the
prefixed id for **every** object-derived form, so this was the normal path, not an edge
case. An object-derived `password` field therefore put the secret on screen in clear text,
and an object-derived `email` field lost its native keyboard and validation.

The two spellings now get the answer each deserves:

- **`field:password` refuses.** Reaching the unregistered default with a registry key
  proves the app shipped without the widget it declares, so the value is not rendered at
  all — no input, nothing carrying the secret in the DOM. In its place is an inline
  `role="alert"` refusal naming the missing widget, plus a `console.error` that doubles as
  the fix instruction. Masking alone would still invite a user to type a secret into a form
  whose password widget is absent.
- **`field:email` renders the native email input**, because the native-input table is now
  keyed on the declared type with the `field:` prefix stripped.
- **The bare `password` / `email` spellings are unchanged.** They claim no registered
  widget, the default branch is their intended home, and their native input stays exactly
  as it was.

Deliberately narrow: only `password` refuses, and only under the `field:` namespace. Every
other unregistered `field:*` id renders the same text box it rendered before, and a
registered `field:password` widget still wins.
