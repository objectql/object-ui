---
'@object-ui/data-objectstack': patch
---

`MetadataClient.layered()` now reads the three-layer view from its declared path,
`GET /meta/:type/:name/layers`, instead of flagging the ordinary item read.

The consumer half of objectstack#5882 (ruled B by the maintainer; the server half
landed in objectstack#6596 and shipped in `@objectstack/spec@17.0.0`). The layered
projection — packaged baseline vs tenant overlay vs merged effective, which is
what the Studio metadata editor's comparison tabs render — used to be reached by
hanging a query flag on `GET /meta/:type/:name`. One route therefore answered two
unrelated representations chosen by a query parameter, while `packages/spec`
declared only the unflagged one: anything generating a client from the route
table produced a parser that was simply wrong for the flagged call. The
projection now has a path of its own and a response schema of its own
(`GetMetaItemLayeredResponseSchema`).

Same body, same envelope, so nothing in the editor changes shape: `code`,
`overlay`, `overlayScope`, `effective`, the load-time `_diagnostics` and the full
ADR-0010 protection envelope all still arrive on one round trip, and `?package=`
(ADR-0048) is still threaded — the two entry points are served by ONE handler
upstream precisely so the deprecation window's promise holds. The retired
spelling still answers during that window, marked with RFC 9745 `Deprecation` and
an RFC 8288 `Link: rel="successor-version"` pointing here, so this migration is
safe against a lagging backend for as long as the window stays open, and it is
what lets the maintainer close it.

One behaviour delta rides along, and it is the server's design rather than a
choice made here: the retired flag FELL THROUGH to the plain item read when the
backend's protocol implementation had no layered support, answering the
`{ type, name, item }` envelope. A dedicated path refuses to answer a different
resource under this one's declared shape and returns 501 `NOT_IMPLEMENTED`, which
surfaces as a failed read instead of a comparison view whose `code` and `overlay`
are silently blank.

The request is built in this package rather than delegated to
`@objectstack/client` because the SDK expresses no layered read in either
spelling — the framework's REST route ledger records the route as `server-only`,
"consumed by objectui over plain HTTP", and whether the SDK should express it is
an open upstream product call. The new path expectation is derived from the
installed `@objectstack/spec` route table, and a ratchet keeps any shipped source
file or skills guide from reaching the projection by query flag again.
