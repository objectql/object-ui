---
---

Tooling only, no package released: every `scripts/**` entry guard now goes through one predicate. The 29 hand-typed guards `check-entry-guard.mjs` baselined (nine distinct spellings across 28 `.mjs` files, plus `shadcn-sync.js`) are converted to `isEntrypoint(import.meta.url)` and `KNOWN_HAND_TYPED_GUARDS` is empty. Twenty-eight of them were silently wrong: reached through a symlink they compared two different paths, answered `false`, and did nothing — exit 0 with no output, which a CI wrapper holding `result.status` reads as a pass (objectui#6092).
