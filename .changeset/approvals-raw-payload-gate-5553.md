---
'@object-ui/console': patch
---

The Approvals Inbox no longer shows a business approver the submitted record's raw
row JSON.

The detail drawer's "Raw data (JSON)" panel rendered on `payload != null` alone — no
principal check of any kind — so every approver could expand (and one-click copy) the
complete raw snapshot: `id`, `created_by`, `updated_by`, `owner_id`,
`organization_id`, bare lookup ids, and **the fields the object's metadata declares
`hidden: true`**. Reported from a live EHR deployment on 17.1.0
(objectstack-ai/objectstack#10734), where that declaration is a patient-data control.
The app author had no legitimate lever to remove the panel — field `hidden`, view
columns, app navigation, permission sets and env vars are all ineffective against it —
so the remedies available in the field were patching the shipped bundle or injecting
CSS.

The panel is now gated on `holdsStudioAccess`, reused verbatim from the console's
`studioEntry` module: `studio.access` is a declared platform-scope capability that a
tenant org owner does not hold by design, and it already reaches the browser in
`systemPermissions[]` from `/api/v1/auth/me/permissions`. Nothing new is served,
computed or made authorable — no new config key, no new i18n copy, and the panel is
byte-for-byte unchanged for the platform operator it was written for. A business
approver keeps the structured record summary, the approval chain, the activity feed
and the decision actions; only the raw snapshot is gone.

The gate reads the RAW `systemPermissions` signal and fails **CLOSED**, inverted from
`usePermissions().hasCapabilities`. That hook fails open on purpose — hiding a
holder's button while the server still refuses the write is the worse outcome for an
action. This panel has the opposite stake, since the measured defect is a non-holder
seeing it, so every not-a-reported-grant answer denies: no provider mounted, a backend
predating ADR-0066 that omits the field, the resolver's `catch` path that answers `200`
with no `systemPermissions` at all, and a reported empty array. A deployment whose
permission layer just failed must not be the one that leaks the snapshot.

`ApprovalsInboxPage.rawPayloadGate.test.tsx` pins all four verdicts. Because the
acceptance condition is that something does *not* render — which an empty render
reproduces perfectly — every denial case also asserts the drawer it denies inside, and
the `studio.access` case drives the same fixture through the same helper and finds the
panel. `created_by` and `organization_id` are the witnesses: both are in the page's
`PAYLOAD_SYSTEM_KEYS`, so the summary card already drops them and their values can
reach the DOM only through the raw panel. Ablating the gate (restoring the bare
`payload != null` condition) turns the three denial cases red on exactly that
assertion and leaves the holder case green.

Out of scope, tracked separately: trimming the summary by object metadata, and the
server-side residual that sends the unfiltered snapshot to the client at all.
