---
'@object-ui/plugin-detail': patch
---

`record:path` now derives ONE stage classification and hands it to both of its rows, so a
stage can no longer paint and announce two different ways depending on viewport width
(objectui#5998).

The renderer draws a desktop row (`hidden sm:flex`) and a mobile row (`flex sm:hidden`) from
the same `stages[]`, and each used to compute its own `terminal` from that array.
`renderStage` passes the same `terminal` to `railClass` and — since objectui#5957 — to
`stageAriaLabel`, so any disagreement surfaced in the colour and in the accessible name at
once. The rows disagreed on two axes:

Mid-path goal. `WON_TOKENS` matches `完成`, an ordinary word rather than a Salesforce-style
`closed_won` value, so a path like `草稿 → 完成 → 已归档` classified index 1 as `won`.
Desktop declined it, because only the last forward stage can be the goal terminus; mobile
marked it `bg-emerald-500/30` and announced `goal stage, not reached`.

The lost slice. Desktop renders `stages.slice(firstLostIdx)` as a visually separated alt
group and hardcoded `terminal: 'lost'` on every member of that positionally-defined group,
while mobile classified each stage on its own. A plain stage after a `lost` one
(`草稿 → 失败 → 已归档`) therefore painted destructive and announced `closed lost` on
desktop and plain on mobile; a `won`-classified stage in the same position drew `'lost'`
from one row and `'won'` from the other.

Both rows now index a single `stageTerminals` array: `lost` is a property of the stage
itself, `won` is the goal terminus and so is the last forward stage or nothing, and the
positional grouping is a layout concern that no longer overrides what a stage is. Behaviour
is narrowed on both axes and never widened — no stage gains a `terminal` on either row that
it did not already carry there, and a goal terminus that really is last keeps its faint
emerald rail and its `goal stage, not reached` name on both rows.
