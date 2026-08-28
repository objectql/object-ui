---
'@object-ui/sdui-parser': minor
---

html tier: a braced attribute value that is not strict JSON now draws a `inert-expression` warning instead of vanishing silently (objectui#6598)

`interpretBrace` materializes strict-JSON values only; anything else — the
single-quoted array every JSX author writes (`columns={['name','amount']}`),
unquoted object keys, any JS expression — compiles to the deferred `{ $expr }`
marker, and nothing downstream evaluates that marker: the html tier parses,
never executes (ADR-0080), and no renderer consumes `$expr`. The value reached
the renderer as an opaque object, defensive non-array/non-object reads degraded
it to "not declared", and the author's binding vanished with zero diagnostics
anywhere — a production page's `list-view` rendered its row count and toolbar
with no data columns, through eight `columns` spellings (objectui#6598, moved
from objectstack#12649). That is ADR-0078's prohibited parsed-but-silently-inert
state.

`validateTree` now emits a warning-severity `inert-expression` diagnostic when a
declared input's value is the `$expr` marker, with the fix in the message: write
the value as JSON (double-quoted strings and keys). Warning, not error, per the
objectui#5709 posture for inert authored keys — pages keep compiling and
rendering exactly as before; the silence is what changed. Escalating the
severity, widening the accepted literal grammar (e.g. materializing
single-quoted strings), and covering base props like `style` are contract
decisions deliberately left on objectui#6598.
