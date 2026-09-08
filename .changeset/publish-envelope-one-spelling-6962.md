---
'@object-ui/data-objectstack': patch
---

**Fix:** `MetadataClient.publishDraft` no longer unwraps a `{ success, data }`
envelope, so it and `MetadataClient.publish` hold ONE belief about the route
they share (objectui#6962).

The two methods sit ~250 lines apart in `metadata-client.ts` and both POST
`/api/v1/meta/:type/:name/publish`. `publishDraft` tolerated a dispatcher-shaped
envelope and returned the inner object; `publish` returned the body as parsed.
Nothing said which was right, and the card explicitly refused to settle it from
`PublishMetaItemResponseSchema` alone — an inference from a declaration is not a
measurement of the server.

So the producer was read instead, in the framework checkout:

- `POST /api/v1/meta/:type/:name/publish` has exactly ONE mount,
  `packages/rest/src/rest-server.ts`, whose handler ends
  `res.json(await p.publishMetaItem(publishRequest))` — the protocol object
  verbatim, no envelope branch on any arm. The ADR-0006 project-scoped base
  re-mounts that same handler.
- The `{ success, data }` envelope has ONE producer, `HttpDispatcher.success()`,
  and it does not serve this route: no publish branch in `runtime`'s `/meta`
  domain (its three-segment arm is `/published`, GET only), no row in the
  dispatcher's route ledger, and a three-segment `/meta` path that is not
  `/published` terminates in a located `routeNotFound`. That holds for the
  dispatcher-only Hono adapter as much as for a full `rest` +
  `plugin-hono-server` boot, where the REST mount shadows the catch-all.
- `packages/spec` declares the split in so many words:
  `PublishMetaItemResponseSchema` documents "the FULL body" of this route and
  records that the REST route hands the producer's object to `res.json()`
  verbatim, while the batch sibling `PublishPackageDraftsResponseSchema`
  documents a body answered "inside the dispatcher's `{ success, data }`
  envelope".

The route never envelopes, so the tolerance was a dialect with no producer —
Commandment #0.1's lenient fallback, and the kind that fails in the direction
that hides the problem: a body arriving enveloped is one this door did not
serve, and unwrapping it presents that as a successful promotion.

**Behaviour delta, stated plainly.** Handed an enveloped body, `publishDraft`
used to return the inner object and now returns the body as-is. Graded `patch`
because that input is not one any measured configuration emits: on a conformant
response — which has no `data` member at all — the removed branch was already a
no-op, so `seedApplied`, `version` and `seq` read off both methods exactly as
before. Sibling tolerances in the same file are untouched and still correct:
`listDrafts` reads `data?.data?.drafts` because `GET /meta/_drafts` really is a
dispatcher route, and `publishHealthFromResponse` unwraps because the batch
publish door really is enveloped. The rule is per-route, not per-file.
