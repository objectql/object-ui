---
'@object-ui/i18n': patch
---

`view.readonlyTooltip` — the tooltip on a view tab's read-only lock — is
retranslated in the eight packs (ja/ko/de/fr/es/pt/ru/ar) that still described
the retired "duplicate to customize" workflow, so a Japanese, Korean, German,
French, Spanish, Portuguese, Russian or Arabic session is told the view is
defined in code and read-only, which is what `en` says and what the product
does (#3625).

This is the same stale sentence #3582 fixed one namespace over, but it hid
behind a much better disguise. In #3582 the eight packs stored the **English**
string, so two cheap criteria could see it: "value equals `en`" and "a
non-Latin pack holds pure ASCII". Neither can see this key. Its eight values
were **idiomatic translations** — real Japanese, real Cyrillic, real Arabic —
of a sentence `en` itself had already abandoned. Nothing about their form was
wrong; only their meaning was. Key sets were complete, so
`all-locales-key-parity` was green; the key exists in `en`, so the call-site
guard and its ratchet were green; the values are distinct and in their own
scripts, so every heuristic #3582 sketched would have been green too. Eight
locales spent those releases pointing users at a path the product no longer
offers, with every gate reporting success.

Each value is translated against `en`'s **current** meaning and built from
words the same pack already uses — "read-only" from its own `view.readOnly` /
`view.readonlyAriaLabel`, "defined in code" from
`console.objectView.systemViewReadonly` / `cannotEditMetaView` — so the tooltip
agrees with the copy beside it instead of introducing a ninth way to say
read-only. Nothing is rewritten from the stale text.

`en` and `zh` are unchanged, byte for byte, and no key is added or removed —
the diff is eight values in eight files. A new
`viewReadonlyTooltip-semantics-3625.test.ts` tests **meaning** rather than
form, in both directions: no pack may name the duplicate/copy workflow in its
own language, and every pack must positively carry all three pieces of the
sentence ("system view", "defined in code", "read-only") so the negative check
cannot pass on a gutted string. It also pins the `en` literal, so the next
rewording of `en` fails in the PR that does the rewording rather than orphaning
nine translations for another release — which is the invariant this family of
defects has actually been missing.
