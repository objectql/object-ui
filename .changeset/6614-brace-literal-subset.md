---
'@object-ui/sdui-parser': minor
---

html tier: braced attribute values now materialize the JS literal subset — single-quoted strings and unquoted identifier keys work (objectui#6614)

The html tier is the untrusted-safe DATA tier: source is parsed, never executed
(ADR-0080), which makes it the only safe carrier for runtime AI- or
tenant-authored pages. But `interpretBrace` accepted only strict JSON inside
braces while the surface called itself JSX, so `columns={['name','amount']}` —
the spelling every JSX author and every AI author writes by habit — compiled to
the deferred `{ $expr }` marker that nothing downstream evaluates, and the
author's whole data binding vanished at render. A production page's `list-view`
rendered its row count and toolbar with zero data columns through eight
`columns` spellings before the author gave up (objectui#6598, moved from
objectstack#12649). That was a trap, not a contract.

`interpretBrace` now materializes the JS **literal subset**. Exactly two
widenings over JSON, and nothing else:

1. **single-quoted strings**, in value position and in key position —
   `title={'Accounts'}`, `columns={['name','amount']}`, `{{'pageSize': 25}}`;
2. **unquoted identifier object keys** — `options={{pageSize: 25}}`,
   `columns={[{field:'name',label:'Full Name'}]}`.

Everything else JSON refuses is still refused, still compiles to `{ $expr }`,
and still draws the warning-severity `inert-expression` diagnostic: trailing
commas, comments, array holes, spreads, `undefined`/`NaN`/`Infinity`,
`+1`/`.5`/`1.`/`0x1f`, template literals, and every genuine expression —
identifiers, member access, calls, operators, ternaries. The subset contains no
identifier lookup and no operator, so there is nothing in it to execute: this
moves habitual spellings onto the materialized side, it does not move the
boundary between data and code. An authored `__proto__` key becomes an ordinary
own property, as `JSON.parse` gives it — never the prototype setter.

Strict JSON is unchanged, structurally: `JSON.parse` still runs first and
untouched, so any value it accepts takes byte-identically the path it always
did, and the literal reader only ever sees input `JSON.parse` has already
thrown on.

The `inert-expression` message changed with the grammar. It used to advise
"write it as JSON (double-quoted strings and keys)" and named
`columns={['name','amount']}` as the wrong form — advice that would now send an
author to edit working source. It names the accepted literal grammar instead.

Maintainer ruling of 2026-08-28 (objectui#6614 Q1-A). ⛔ Two ruled items are
deliberately NOT in this change: escalating `inert-expression` from warning to
error (Q2 — it belongs at the save gate, once the framework wires the registry
manifest into `validate-jsx-pages`), and base-prop (`style`) `$expr` inertness
(Q3 — sequenced after this, so no warning is added for spellings this change
legalises).
