---
'@object-ui/plugin-detail': minor
---

`resolveTitleField` delegates to the shared ADR-0079 ladder (objectui#7287).

ADR-0079 collapsed ~6 divergent record-title resolvers onto one — `@object-ui/core`'s
`record-title.ts`, whose header tells the "Untitled everywhere" story that produced it.
`plugin-detail` grew one back. `resolveTitleField` now calls core's `resolveNameField`
and nothing else, so the detail page, the list column and the lookup chip cannot
disagree about which field titles an object.

**Two rungs are gone.**

`def.primaryField` — a `DetailViewSchema` key (`@object-ui/types` `views.ts`), read off
an OBJECT def and ranked ABOVE the canonical `nameField` ADR-0079 Phase 2 made the
pointer (AGENTS.md Commandment #0.1). No producer can put it there: `@objectstack/spec`'s
object schema is a `strictObject` that answers `unrecognized_keys: ['primaryField']`,
and `ObjectSchema.create()` throws — which is why objectstack#6326 deleted the identical
read from two lint rules. A census across both repos found **zero** object payloads
carrying it (the only writers are three test fixtures), and `primaryField` appears in
**zero** files of the shipped `@objectstack/spec@17.2.0` dist against 68 for `nameField`.
Same shape as the undeclared `objectDef.titleField` read objectui#6531 measured and
#6557 removed. `DetailViewSchema.primaryField` is untouched and still honoured by
`DetailView`'s own header — it is a view key, and on a view it is legitimate.

The literal `['name','full_name','title','subject','display_name']` walk — a NAME match
with no type check.

**User-visible, deliberately.** Two shapes retitle:

- An object with no conventional name field — `{ due_at: datetime, headline: text }` —
  resolved to `null` here while every other surface titled the record `headline`. The
  detail page now agrees, and the highlight strip stops repeating the H1 as its first
  chip (the objectui#2548 duplication, which until now only DECLARED titles were spared).
- A field named `title` of a non-title-eligible type (e.g. a `select`) was chosen by
  name alone and is now correctly skipped, so the strip no longer hides a chip on
  account of a field the H1 never shows.

**A third user-visible change, in the highlight strip's skip set.** It previously read
`primaryField`, `nameField` and `displayNameField` separately and skipped EVERY declared
one; it now skips the single field the shared ladder resolves. These differ on one input:
an object declaring `nameField` and the deprecated `displayNameField` alias to DIFFERENT
fields. The alias's field is no longer hidden from the strip — deliberately, because
`getRecordDisplayName` reads the same ladder and renders the WINNER's value, so the loser
is an ordinary field the H1 never shows and hiding it spent a strip slot for nothing.
This also makes the heuristic branch agree with the declared branch, which has only ever
filtered a single title field.

`deriveHighlightFields` asks the retirement gate (objectui#4914) about the title field
**before** skipping it: an object whose only retired-typed field is the one that titles
it must still get its report, which skipping-first would have silenced.

`ObjectDefLike.primaryField` stays DECLARED but is never read. The interface is
re-exported from this package's index and this package is published, so removing the
member would narrow a shipped `.d.ts` — a contract change owed its own card, not a rider
on a behaviour fix.
