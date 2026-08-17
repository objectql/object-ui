---
'@object-ui/components': patch
---

The `span` renderer renders its content again — it reads `children`, the key its own type declares and its producers emit.

The renderer read `schema.body` and nothing else, and no producer on either of
its authoring surfaces emits that key. In a `kind:'html'` page the parser
assigns compiled child nodes to `children`
(`@object-ui/sdui-parser`'s `parse.ts`), so an author writing the plain inline
tag with text inside it got an EMPTY element back — the text was dropped with no
warning and no diagnostic, because the parser's tree validation does not inspect
child keys. A sibling paragraph on the same page rendered normally, which is what
made this read as anything but a compile failure. On the JSON surface the same
thing happened to anyone following the declaration: `TextSpanSchema` declares
`value` and `children`, so `children` is what an author writes, and `children` is
what rendered nothing.

The canonical child key is `children` — what the type declares, what the parser
emits, and what the sibling `div` renderer already reads. `body` is deliberately
NOT accepted as a second spelling: a tolerant read would fossilize a second
de-facto contract for the one type whose declaration never named it
(Commandment #0.1), and a repo sweep found no page, example, catalog entry or
metadata document authoring it on this tag. A pin test states both halves — the
content renders, and a `body` alias renders nothing — so re-adding the lenient
read turns a test red rather than passing review.

Reachability, stated plainly: the `span` type is deprecated for JSON-authored
pages, but it is permanent first-class vocabulary of the `kind:'html'` tier,
where the tag is compiled straight through and no other spelling exists. So the
authors who could do nothing about the deprecation were exactly the ones losing
their text.

Not changed here, and named because the declaration still promises it: `value`
on this tag is declared by `TextSpanSchema` and read by nobody, as it was before
this fix. Making it render needs a ruling on precedence against `children`,
which belongs with the wider child-key drift (objectui#4631) rather than in a
rendering-path fix.
