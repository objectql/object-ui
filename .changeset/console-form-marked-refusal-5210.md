---
'@object-ui/react': minor
'@object-ui/components': patch
---

The console form now renders a refusal message the producer explicitly marked
as user-facing, instead of always substituting a generic string
(objectui#5210).

An application's hook guards could not talk to their users. When a hook refused
a write with 403, the form replaced the server's text with
`form.noPermissionToSave` unconditionally — the recorded objectstack#3821 fix,
which exists because a raw refusal body puts untranslated platform diagnostics
(`FORBIDDEN: insufficient privileges to update showcase_private_note
pi-TgoJ4_DM55Fqz`) in front of end users. The external report behind this change
had 11 guards whose deliberate, localized guidance — which role owns the action,
whom to ask — never reached anyone, and named the incentive that creates:
returning 400 instead of 403 for permission failures, degrading the status
semantics logs, monitoring and API consumers depend on.

The maintainer ruling (2026-08-19) was a producer-side opt-in rather than a
chattier 403 branch, and the platform half shipped as objectstack#9934: a hook
marks its refusal text with `userMessage` at throw time. This is the consumer
half.

- `@object-ui/react` gains `declaredUserMessage(err)` — the one "is this
  marked?" read. It answers the marking verbatim, from the two places the
  adapter boundary parks the envelope (the error itself, where
  `@objectstack/client` lifts it, and `details`), and `null` for everything
  else.
- The form prefers a marked message over both its generic strings, on ANY
  status — the marking is status-agnostic; 403 is where this was reported, not
  a fence the contract draws.

**Unmarked refusals are unchanged**: a 403 with no marking still shows the
generic `form.noPermissionToSave`, and the raw text still goes to the browser
console only. objectstack#3821's protection is preserved by construction, not
by re-guessing which 403 bodies are presentable — the mark and the marked text
are one field, so no boundary that rewraps or substitutes `message` can promote
platform prose into the user-facing channel, and platform code never sets it.
