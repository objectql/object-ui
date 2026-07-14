---
"@object-ui/app-shell": patch
---

fix(console-ai): Studio dock remembers a collapse; folded canvas+properties go side-by-side at `xl` (ADR-0057 UX follow-ups, #2477)

- **Studio dock collapse is now remembered** (per-tab). The right copilot still
  mounts expanded by default, but collapsing it to get the classic three-zone
  canvas no longer re-opens on every pillar / package switch or Studio
  re-entry. Backed by an explicit `'0'`/`'1'` stored flag (a default-expanded
  surface couldn't remember a collapse when "collapsed" meant "key removed"),
  under a Studio-specific key so it never shares state with the console dock.
- **Folded layout shows canvas + properties side by side from `xl`** (1280),
  lowered from `2xl`. On the common laptop the folded center used to fall into
  tabs, which auto-hide the canvas the moment you select a block — breaking the
  WYSIWYG "edit and watch it apply" loop. The side-by-side inspector is slimmer
  at `xl` (and grows at `2xl`) so the canvas keeps usable width beside the dock.
