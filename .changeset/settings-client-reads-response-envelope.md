---
'@object-ui/console': patch
---

Settings pages read the declared `{ success, data }` response envelope, so the
whole Setup → Configuration section works again against a framework#3843 server
(objectui#3366).

`service-settings` moved all five `/api/settings` responses into the platform
envelope and its changelog named the cost for callers that do not go through
`@objectstack/client`: "Raw `fetch` callers must add one hop: `body.data`." The
console's settings client is one of those callers and never took the hop, so on
17.0.0-rc.3 it handed the envelope to the views:

- every namespace page (localization, company, branding, auth, mail, sms,
  storage, AI, knowledge base, feature flags, data lifecycle) hit
  `Object.entries(payload.values)` on an object with no `values`, threw
  `Cannot convert undefined or null to object`, and went to the error boundary;
- the "All settings" hub read `manifests` off the envelope, got `undefined`,
  and rendered "no settings are registered" while the server was answering 11
  manifests — a soft failure that reads as a plugin bug;
- a save's read-back merged nothing, leaving stale values under a success toast;
- an action's verdict was not where the client looked, so its `message` and
  `severity` were dropped and the toast read the bare HTTP status text.

## What changed

- `jsonOrThrow` unwraps the envelope with the exact predicate
  `ObjectStackClient.unwrapResponse` uses — `success` is a boolean **and**
  `data` is present. Requiring both is what keeps error envelopes
  (`{ success: false, error }`) intact, so `err.payload.error` still feeds the
  locked-key and per-field-rejection rendering from objectstack#4224. A body
  with no boolean `success` is a pre-#3843 server and passes through untouched.
- The action endpoint reads its verdict from the success envelope's `data`, and
  on the reported-failure arm from `error.details`, where the route deliberately
  parks the whole result so `message` / `severity` / `details` survive the 400.
- Each endpoint now asserts the shape it promises and throws a named
  `Malformed response from …` error instead of passing a wrong-shaped body on.
  Both symptoms above were an unreadable body travelling onward as if it were
  right; the views already have an error state, and a named error renders there.
