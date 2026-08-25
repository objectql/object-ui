---
'@object-ui/app-shell': minor
---

Setup gains a **Packaged automation** page — the operational surface for the flows an
installed package ships (ADR-0126 §7.4, objectui#6301). Reached the way every other
framework-contributed Setup surface is: the page registers the component-registry ref
`automation:packaged`, so app navigation names the ref and `ComponentNavView` resolves it
at `/apps/<app>/component/automation/packaged`. No bespoke route is added — a second way
in would be a URL the app metadata does not know about.

Per packaged flow the page does exactly two things:

- **on/off for this scope** — reads the activation state the engine reports
  (`GET /api/v1/automation/_status`, backed by the ADR-0126 §7.2 `sys_metadata_activation`
  ledger) and flips it through `POST /api/v1/automation/<name>/toggle`;
- **clone** — `POST /api/v1/automation/<name>/clone` with a mandatory new machine name and
  label (§7.1). The carried-over definition is never offered as editable form fields; the
  copy is edited in Studio like any other flow.

Authoring stays in Studio. The list is scoped to packaged flows by the server's own
three-clause provenance test (`isCodeArtifactBody`, ADR-0029 D9.6) rather than the
`_packageId`-only shortcut, which classifies a tenant overlay bound to a package as
packaged — the cloud#970 misread, and here it would put a tenant's own flow behind an
install-wide switch.

**Server refusals reach the operator verbatim** — no client-side softening or rewording.
Three shapes are relayed as sent: the §5 posture gate (403 `PERMISSION_DENIED`, whose
message names the tenancy posture *and* the sanctioned clone path), the §7.3 subflow guard
(409 `DELETE_RESTRICTED`, which names the packaged callers that would break mid-run — a
list nothing on the client could reconstruct), and the §7.1 clone name conflict (409).

⛔ **No drift or ancestry surface** (§9): no diff-vs-base, no "customized" badge, no
base-moved notice, no link from a clone back to its source. Cloned-without-disabled and
disabled-without-clone are ordinary states, shown plainly. Tests pin the absence, including
the case where a response carries a `clonedFrom` key anyway — the platform does not track
that lineage, so a page that displayed it would be displaying something it invented.
