---
"@object-ui/types": patch
"@object-ui/data-objectstack": patch
"@object-ui/plugin-list": patch
---

fix(list,data-objectstack,types): exporting a searched list no longer downloads the unsearched superset

The server-streamed export mirrored the view's `filter` and `sort`, and the
code comment claimed that made the file match the screen:

> Mirrors the active view's filter + sort so the exported file matches what the
> user sees.

It mirrored one half. There was no way to carry the term a user had typed into
the search box — `ExportDownloadRequest` had no field for one — so exporting
during a search produced **more rows than the list showed**, in a file that
looks authoritative, with nothing indicating the difference. The client-side
fallback was always correct (it serializes the already-searched `data`); only
the server path was wrong, and it is the one that handles xlsx.

Same family as a dropped filter (objectstack#3948, objectstack#4181): a
plausible answer that is quietly broader than the one asked for.

- `ExportDownloadRequest` gains `search` / `searchFields`.
- `ObjectStackAdapter.exportDownload` sends them as `search=` / `searchFields=`,
  trimming the term and omitting both when it is blank (`searchFields` alone
  means nothing).
- `ListView` passes the active `searchTerm` and the view's `searchableFields`,
  and both are now in the export callback's dependency array — a stale closure
  would export the wrong row set.

Requires a server with objectstack#4230. Older servers ignore unknown query
params on this route, so they keep today's behaviour rather than erroring.

**Also: the filter merge is no longer written twice.** The three filter sources
(view filter, filter-panel group, per-field user filters) were merged by
verbatim copies in the data fetch and in the export — two copies that must
agree, deciding respectively what the user *sees* and what they *download*.
Both now call `buildEffectiveFilter`. This is a pure extraction: the copies did
agree, and the four parity tests added for it pass against the old code too.
They exist to keep it that way — the adapter's duplicated filter-shape check
had already drifted apart unnoticed (#3072).
