---
title: Metadata Diagnostics
description: How ObjectStack surfaces load-time validation problems in Studio.
---

# Metadata Diagnostics

Every metadata item shipped by a package — `object`, `view`, `report`,
`dashboard`, `flow`, `app`, … — is validated against its Zod schema when
the framework loads it. The validation result travels alongside the
item as a `_diagnostics` envelope, and Studio surfaces it at four levels
so authors and operators can fix problems without grepping logs.

> **Backend agnostic.** The shape and the REST endpoint described below
> are part of the ObjectStack protocol. Studio is one consumer; any
> custom UI built on `@object-ui/data-objectstack` can render the same
> envelope.

## The `_diagnostics` envelope

```ts
interface MetadataDiagnostics {
  valid: boolean;
  errors?:   Array<{ path: string; message: string; code?: string }>;
  warnings?: Array<{ path: string; message: string; code?: string }>;
}
```

* `valid === false` means **at least one error** — features that depend
  on the item (rendering, queries, automation) are unsafe to use.
* `warnings[]` is advisory — items remain `valid: true` but operators
  should review (deprecations, performance hints, missing-but-defaultable
  fields).
* `path` is dot-delimited, matching the same convention Zod uses
  (`fields.email.type`, `columns.0.bind`).

The envelope is attached to:

| Endpoint                               | Where the envelope lives          |
|:---------------------------------------|:----------------------------------|
| `GET /api/v1/meta/items/:type`         | Each list entry (`item._diagnostics`) |
| `GET /api/v1/meta/items/:type/:name`   | Top-level (`item._diagnostics`)   |
| `GET /api/v1/meta/items/:type/:name?layered=true` | `effective._diagnostics`    |
| `GET /api/v1/meta/diagnostics`         | Sweep — see next section          |

## The diagnostics sweep endpoint

`GET /api/v1/meta/diagnostics` runs validation across **every metadata
type and item** in one round-trip. It powers the governance overview
page and the per-type tile badges.

```http
GET /api/v1/meta/diagnostics?severity=error
```

| Query        | Default   | Effect                                          |
|:-------------|:----------|:------------------------------------------------|
| `severity`   | `error`   | `error` returns invalid items only; `warning` also returns items with only warnings. |
| `type`       | —         | Limit to a single metadata type.                 |
| `package`    | —         | Limit to one package id.                         |

Response:

```ts
interface MetadataDiagnosticsSummary {
  entries: Array<{
    type: string;
    name: string;
    diagnostics: MetadataDiagnostics;
  }>;
  total: number;          // entries.length
  scannedTypes: number;   // how many metadata types were checked
  scannedItems: number;   // how many items were checked in total
  /**
   * Per-type aggregate stats — count of items and the list of
   * packages contributing to each type. Computed in the same sweep so
   * directory tiles render counts and a package filter without
   * additional round-trips. Empty `{}` on framework versions older
   * than the 7.x line.
   */
  stats: Record<string, { count: number; packages: string[] }>;
}
```

Use this as a CI gate too — `total === 0` is the green-build condition.

## Studio UI surfaces

### 1. Directory page badges

`/apps/<app>/metadata` — the directory is **scoped to the active project
software package** (the sidebar `active_package` selector, published as
`?package=`). Only metadata types that the selected project package
contributes are listed — system/cloud types never appear, and there is no
in-page "All packages" dropdown. If the URL holds no valid project
package the page repairs it to the first available one. Each visible type
tile shows:

* A neutral count badge with the total items of that type. (Note: this
  total spans all packages — the per-type *list* page it links to is
  strictly scoped to the active project package.)
* A red ⚠ + count when any items fail validation (errors).
* An amber ⚠ + count when items have warnings but no errors.

Tiles deep-link into the list page carrying the active `?package=`, so the
scope survives navigation.

The "View all issues (N)" link in the filter row jumps straight to the
governance page.

### 2. Resource list rows

`/apps/<app>/metadata/<type>` — invalid rows get a red ⚠ icon next to
the name and a destructive-tinted background; warning-only rows get an
amber ⚠ and amber tint. The list header shows aggregate "Invalid N" and
"Warnings N" chips. Hover the ⚠ for the first three messages.

The list page is **always scoped to a single project software package**.
Studio's sidebar exposes a mandatory **Package** scope selector (the app's
`active_package` context selector) whose options are the installed
*project* packages — system/cloud packages are never offered and there is
no "All" choice. The selection is published as the `?package=` URL
parameter, which every metadata list reads to filter rows by their
`_packageId`. If the URL holds no valid project package the list repairs
it to the first available one, so system metadata never leaks into the
view. (The page no longer renders its own per-type package dropdown —
scope is owned solely by the sidebar selector.)

### 3. Resource edit banners

`/apps/<app>/metadata/<type>/<name>` — a destructive banner at the top
of the edit page lists the first three errors with their paths; the
same errors are also threaded into the form so the offending fields
get inline messages **without** the user having to click Save first.
Warnings, when present, render as a parallel amber banner.

Edits clear the matching diagnostic immediately — the inline error on a
field disappears as soon as you start typing in it, then re-validates
on save.

For **object** drafts the live validation goes beyond the Zod shape check:
every field conditional rule (`visibleWhen` / `readonlyWhen` / `requiredWhen`,
plus the deprecated `conditionalRequired` alias) is linted as a CEL predicate
with the same `@objectstack/formula` validators the server uses. A predicate
that parses but references an unknown field, or references a field bare
instead of as `record.<field>`, surfaces under its `fields.<field>.<rule>`
path in the banner. The field inspector's *Conditional rules* editors give
the same verdict inline as you type — with autocomplete for the object's
fields (after `record.` / `previous.`), the runtime-bound scope roots
(`record`, `previous`, `parent`), and the CEL stdlib.

Formula fields get the same treatment for their value `expression`: the
inline editor lints it in `role: 'value'` mode and shows the **inferred
result type** (only a proven-Number formula is offered as a dataset
measure), while the draft-wide pass surfaces a broken formula on any field
under its `fields.<field>.expression` path.

### 4. Governance overview page

`/apps/<app>/metadata/_diagnostics` — a single sortable table of every
invalid item across every type, grouped by type, with deep-links to the
offending edit page. Toggle the severity tab to include
warning-only items. This is the page to open during a release readiness
review.

## Authoring metadata that validates cleanly

Validation rules are defined by the Zod schemas in `@objectstack/spec`.
A few high-leverage patterns:

* **Use `defineObject`, `defineView`, … helpers** from `@objectstack/spec` —
  TypeScript catches most shape issues at compile time before they ever
  reach the diagnostics path.
* **Run `os check`** locally before publishing. It calls the same
  validators the server uses on load.
* **Treat warnings like errors in CI.** Pass `severity=warning` to the
  sweep endpoint and assert `total === 0`.
* **Layered overlays merge first, then validate.** If only your runtime
  overlay fails, the source artifact is fine — the bad value is in the
  overlay. The edit banner reflects the *effective* item, so what you
  see is what features will get.

## Client SDK

```ts
import { MetadataClient } from '@object-ui/data-objectstack';

const client = new MetadataClient(/* config */);
const summary = await client.diagnostics({ severity: 'error' });
console.log(summary.total, 'invalid item(s)');
```

The hook used by the Studio surfaces:

```ts
import { useGlobalDiagnostics, useMetadataClient } from '@object-ui/app-shell';

const client = useMetadataClient();
const {
  loading,
  error,
  summary,
  byType,         // Record<type, invalid-item-count>
  warnByType,     // Record<type, warn-only-item-count> (severity='warning' only)
  countsByType,   // Record<type, total-item-count>
  packagesByType, // Record<type, packageId[]>
  allPackages,    // packageId[] — deduped union for filter dropdowns
  reload,
} = useGlobalDiagnostics(client, 'warning');
```

Pass `severity: 'warning'` when you need `warnByType` populated — the
server omits warning-only entries when the default `'error'` severity
is in effect.
