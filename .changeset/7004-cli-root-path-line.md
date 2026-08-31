---
'@object-ui/cli': patch
---

`objectui validate` now says when a validation issue sits at the document root
(objectui#7004, mechanical half).

The printer guarded its Path line with `issue.path.length > 0`, so an issue at
`path: []` printed no Path line at all — silent in exactly the case a reader
most needs oriented. That case is the common one, not an edge: the CLI validates
against `AnyComponentSchema`, a union over every component arm, so any document
matching no arm reports a single top-level issue (`invalid_union` · `Invalid
input` · root path). Authors saw a bare verdict on a whole document with nothing
saying which node had been judged:

```
1. Invalid input
   Code: invalid_union
```

Every reported issue now carries a Path line; a root-level one reads
`Path: (root)`, parenthesised so it cannot be mistaken for a real key named
`root`. Non-root issues print their authored path exactly as before.

Scope: the printer still reads only top-level issues. Whether a failing union
should also surface its per-arm diagnoses — and if so which arm's — is an
author-facing diagnostic contract left open on objectui#7004 for a maintainer
ruling, and is deliberately not decided here.
