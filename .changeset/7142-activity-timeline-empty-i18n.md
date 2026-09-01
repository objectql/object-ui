---
'@object-ui/plugin-detail': patch
---

`ActivityTimeline`'s empty state speaks the session locale (objectui#7142).

The title was a raw English JSX literal — `title="No activity recorded"`, not a
`t()` call and not an inline `defaultValue` — so it never reached the pack
system and stayed English in all ten locales. Measured before the fix by
rendering `activities={[]}` under a zh `I18nProvider`: the card read
`"Activity(0)No activity recorded"`, while its sibling `RecordActivityTimeline`
rendered `"活动(0)全部动态暂无活动记录"` from the same packs.

The call site now reads `detail.noActivity`, the key the sibling already uses.
Reusing it rather than minting a second key is a measured decision: the `en`
pack value for that key is `'No activity recorded'`, byte-identical to the
literal it replaces, so both surfaces were already saying the same words in
English and a new key would have forked one sentence across ten packs for no
copy difference. No pack was edited — the key is already translated in all ten,
verified by reading `detail.noActivity` out of each pack object.

Both routes to the box are covered: an empty `activities` array, and a
populated timeline filtered down to a type with no entries.
