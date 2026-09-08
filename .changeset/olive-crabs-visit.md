---
'@object-ui/app-shell': patch
---

AgentPreview: an empty rail collection now says so instead of drawing a bare em dash

`KeyVals`'s zero-rows branch — every requested key resolved to `undefined`/`null`,
so a Planning / Memory / Guardrails rail block has no key/values at all — rendered
`<div className="text-muted-foreground italic">—</div>`: no role, no label, no text
alternative, so a screen-reader user reached it as a naked punctuation mark. It now
renders `EmptyDescription` from `@object-ui/components` with the text "No values
set.".

This is an empty **collection**, not an empty field value, so `EmptyValue` is the
wrong member of that family: its docblock scopes it to a missing cell/field value
and its `aria-label` resolves `detail.noValue` ("No value"), which would be a false
statement about a collection that simply has no members. The container `Empty` is
not used either — measured in the browser at this rail's real 215px content width
it is 118.8px tall against the 16px row it replaces. `EmptyDescription` at
`text-xs italic` is metrically identical to the row it replaces, so the layout is
unchanged and only the announcement differs.
