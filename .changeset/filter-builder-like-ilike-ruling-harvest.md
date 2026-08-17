---
---

Test-comment only: harvests the maintainer ruling on objectui#4911 into the
`KNOWN_UNREACHABLE` entry for `$like` / `$ilike` in
`FilterConditionField.operators.test.ts`. The entry's justification was landed as a CITED
OPEN QUESTION ("undecided — see #4911") to unblock the queue while the authoring-surface
call was pending; it is now rewritten as the decision it became — ruled B on 2026-08-17,
the visual FilterBuilder deliberately does not offer raw pattern-matching authoring, the
constrained intents (`contains` / `containsCaseInsensitive` / `startsWith` / `endsWith`)
are the authorable surface, and the API surface is unaffected since spec goes on accepting
both operators for hand-written ObjectQL and direct JSON authors. The ruling's named
reopen condition (a real user or deployment asks to author wildcard patterns in the UI) is
recorded on the entry, because the exclusion ratchet can only check that a member is still
a spec operator, never that its reason is still the true one.

The two `KNOWN_UNREACHABLE` members, the reachability sweep and the exclusion ratchet are
unchanged; no operator was added or removed. Declared as releasing nothing.
