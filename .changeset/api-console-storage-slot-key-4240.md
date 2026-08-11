---
'@object-ui/console': patch
---

API Console renders the Storage group again — its catalog key now names the canonical `file-storage` slot instead of the route

The API Console's service-gated groups are keyed by canonical service-slot name, because the key is looked up directly in `/discovery`'s `services` map — and the framework keys that map by `CoreServiceName`. The storage group was keyed `storage`, which is the *route* (`/api/v1/storage`), not the slot (`file-storage`). So the lookup missed on every host, and because a miss is indistinguishable from "no such service" the deliberate fail-closed branch (ADR-0076 D12) hid all three storage endpoints — upload, download, delete — on every deployment, whether or not a storage service was registered and healthy.

The fail-closed posture was never the defect and is unchanged; only the key moves. The group's user-facing name stays `Storage` — that is the route's name, and it was never derived from the catalog key, so no display string and no i18n resource changes.

The mis-key survived because nothing tied the catalog's keys to the vocabulary they are spelled in: a wrong key produces silence, not an error, and an empty group is exactly what a legitimately absent service looks like. A tripwire now derives that vocabulary from `@objectstack/spec` itself and asserts every service-gated catalog key against it, so a rename on either side fails a test instead of quietly emptying a group. Deriving it also surfaced two further keys that name no slot and therefore can never render — `workflow` (slot retired upstream) and `feed` (never a slot) — recorded as a documented exception set pointing at objectui#4303 rather than fixed here, since neither has a correctly-spelled name to move to.
