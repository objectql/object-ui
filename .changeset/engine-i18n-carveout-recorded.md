---
---

Docs only (objectui#4662): records the `engine.*` carve-out where the i18n
conventions live — `packages/i18n/README.md` gains a "Scope" section stating
that the metadata-admin (Studio) namespace resolves through a module-local
`en`/`zh` table rather than the ten locale packs, why that is Phase 3f design
rather than drift (the server's `/meta/types` `label` is the primary path; the
table is the fallback), the two consequences (eight locales render English
there; the i18n gates cannot see the namespace by construction), and the
condition for revisiting it. `packages/app-shell/src/views/metadata-admin/i18n.ts`
gains a header note pointing at that section — a comment-only edit. No key was
migrated, no locale pack was touched, and no published behaviour changes.
