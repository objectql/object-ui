---
'@object-ui/plugin-detail': patch
'@object-ui/i18n': patch
---

`ActivityTimeline` speaks the session locale — the other 18 literals
(objectui#7149).

objectui#7142 gave this component its first `t()` call (the empty-state title)
and filed the sweep that found the rest. Until now a zh activity tab read
`"Activity(0)暂无活动记录"`: one translated string in a component that was
otherwise entirely English.

All 18 now resolve from the ten packs, in three groups:

- **Relative timestamps and the card title** (`just now`, `{{count}}m/h/d ago`,
  `Activity`) — these render on *every* activity tab. All five were a pure
  lookup swap: the `en` pack value was already byte-identical to the literal,
  and the sibling `RecordActivityTimeline` already used the same keys.
- **The `formatFieldChange` sentences** — assembled in code, so they needed new
  keys *with* interpolation holes rather than a lookup. Same reachability as the
  timestamps: they render for any entry whose optional `description` is absent.
  The quotes live inside each pack's value, so every locale punctuates its own
  way (de `„…“`, zh `“…”`, ja `「…」`, fr/ru `«…»`).
- **The six filter chips and the chip group's accessible name** — reachable only
  through the published export, since no host in this repo passes `filterable`.

Ten new `detail.*` keys across all ten packs (no inline `defaultValue` —
objectui#3517), mirrored byte-for-byte into `DETAIL_DEFAULT_TRANSLATIONS` so a
provider-less host still reads English rather than a raw key.

One deliberate English copy change: the chip group's `aria-label` was
`"Activity type filter"` and now resolves `detail.filterActivity`
(`"Filter activity"`) — the key `RecordActivityTimeline` already uses for the
accessible name of its own activity filter, so one control does not carry two
names across two components.

Also drops the unused `Filter` import (a pre-existing eslint warning).
