---
'@object-ui/console': patch
---

Stop reporting a successful key-mint response that carried no key as
`Request failed (200)` (objectui#8782).

The Connect-an-agent panel guarded its key mint behind one disjunction, so both
failure modes reached one `throw`:

```ts
if (!res.ok || !data?.key) {
  throw new Error(json?.error?.message || `Request failed (${res.status})`);
}
```

The second arm fires on a response that WAS `ok`, and with no `error.message` in
the body the template interpolated the real status — a `200` whose body simply
carried no key was reported to the developer as `Request failed (200)`. Nothing
about the transport went wrong; the sentence named the one layer known to have
worked. That string lands in `setError(...)` and is the entire report the
developer gets, so the wrong pointer is the whole report — and an agent or a
developer reading "request failed" goes and investigates the transport, which is
the wrong layer.

The two arms are now separate and say different things. `!res.ok` is unchanged,
including its `error.message` read. The keyless-success arm gets its own
sentence, which quotes no status: *"The request succeeded but the response
carried no API key. Nothing failed in transit — inspect the response body of
POST /api/v1/keys."*

The arm is reachable through this consumer, not through the route. The mint
route's only success is `201` and it always carries `data.key`, so it cannot
emit a keyless success; the arm is where `await res.json().catch(() => ({}))`
lands every 2xx whose body is not that envelope — an SSO or proxy interstitial
answering `200` with HTML, an empty body, a gateway page. Those are exactly the
responses for which "request failed" misdirects hardest.

Both arms are pinned, the keyless-success case with a control that fires on the
same command shape so its absence assertions are a reading rather than a vacuous
pass.
