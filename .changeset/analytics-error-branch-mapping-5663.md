---
'@object-ui/data-objectstack': patch
---

`ObjectStackAdapter.queryDataset` now maps a failed dataset query by the server's
ADR-0112 error `code`, not by the HTTP status, so an unknown dataset and an
unauthenticated session stop being reported as a missing analytics capability
(objectui#5663).

Two unrelated conditions answer **404** on `POST /api/v1/analytics/dataset/query`:
the runtime dispatcher's `ROUTE_NOT_FOUND` when the route was never mounted, and
the route's own `NOT_FOUND` when `body.datasetName` matches no saved dataset. The
mapping tested `res.status === 501 || res.status === 404` and called all of it
"the analytics capability is not installed", so every unknown dataset produced a
banner telling the operator to install `@objectstack/service-analytics` and mount
`AnalyticsServicePlugin`. Measured live on a prod tenant, that banner was shown on
four HotCRM Executive Overview widgets while the analytics service was installed
and answering — the real condition was an installed `app.objectstack.hotcrm` at
1.3.0 whose datasets ship in 2.2.2, i.e. a package upgrade, the opposite corner of
the system from the remedy the banner named.

Three conditions now get three answers, each keyed on the code the framework
declares for it:

- `NOT_IMPLEMENTED` (501, route mounted with no analytics service) and
  `ROUTE_NOT_FOUND` (404, route not mounted) keep the existing
  `AnalyticsNotInstalledError` and its copy — one remedy, one message.
- `NOT_FOUND` (404, unknown `datasetName`) throws the new
  `AnalyticsDatasetNotFoundError` (`ANALYTICS_DATASET_NOT_FOUND`), naming the
  dataset and pointing at the installed app's version rather than at the server.
- `UNAUTHENTICATED` (401, `enforceAuth`) throws the new
  `AnalyticsUnauthenticatedError` (`ANALYTICS_UNAUTHENTICATED`), which says the
  request was refused before it ran and therefore says nothing about the
  capability.

The banner also used to print the server's own message in a parenthetical while
contradicting it in the headline — it quoted `Dataset "opportunity_metrics" not
found.` under a headline claiming a missing capability. That is now structurally
impossible rather than merely fixed: the headline is a pure function of `code` and
the parenthetical is a verbatim quote of `message`, both read off the same
response, and a test walks every branch asserting each message carries its own
headline and none of the others'.

Additive only. `AnalyticsNotInstalledError` keeps its `code`, its copy and its
constructor signature (it gains an optional third `serverCode` argument and a
`serverCode` field), so consumers matching `ANALYTICS_NOT_INSTALLED` — including
the metadata-admin dataset preview — are unaffected. A 404 carrying a code this
client does not recognise, such as the analytics cube gate's `CUBE_NOT_FOUND`, now
keeps its server detail instead of being relabelled as a missing capability; a 404
or 501 carrying no code at all is still read as the capability being absent, since
the route's own `NOT_FOUND` always ships a code.
