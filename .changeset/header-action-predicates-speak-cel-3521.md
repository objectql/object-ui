---
"@object-ui/components": patch
---

Record page header action predicates now speak CEL, like every other action surface

`visible` / `hidden` / `disabled` on a `page:header` action were handed to
ObjectUI's legacy JS evaluator, while the row kebab, the selection bar and
conditional formatting have evaluated the identical metadata on the canonical
CEL engine since objectui#1584 / ADR-0058. Every construct that exists only in
CEL therefore worked in a list row and threw on the record page — where the
throw fail-closed hid the button, leaving nothing on screen to notice:

- method calls — `record.f_tags.size() > 0`, `record.f_textarea.contains("x")`
- the `in` operator — `'"red" in record.f_multiselect'` (a parse error)
- stdlib functions — `record.f_date < today()` (`today is not a function`)

Both header evaluation sites now go through `evalRowPredicate`: the same entry,
the same bindings (`record.*` + bare field names + `data.*` + the host scope,
with relations bound as the stored foreign key), and the same fail-closed +
warn-once semantics as the row surfaces. One predicate on one record now reaches
the same show/hide verdict in the row menu, the selection bar and the record
header.

Legacy-dialect strings are unaffected: `${…}`, `===`/`!==`, `?.`, `??` and
JS-only methods such as `.includes()` still route to the legacy evaluator (with
its existing one-time deprecation warning), so authored pages keep working. A
`${…}` template predicate, which the header previously could not evaluate at
all, now resolves through that fallback instead of hiding the button. A
predicate that genuinely cannot be evaluated still hides its action, and now
reports itself once in the same words the other surfaces use, naming the
surface, the action and the predicate.
