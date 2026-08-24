---
---

Comment-only correction in `packages/app-shell/src/preview/DraftChangesPanel.tsx`. The block above the `/meta` spelling fold stated that this file's `@objectstack/spec/shared` import puts that subpath on the console's eager graph, and attached a byte figure and a prohibition to that claim. Ablation on `origin/main` shows the import is worth ~+285 bytes gzipped: the subpath is held eager by a runtime import inside `@objectstack/core`, upstream of this repo. The comment now records the mechanism and points at the upstream card. No source behaviour is touched and no published behaviour changes.
