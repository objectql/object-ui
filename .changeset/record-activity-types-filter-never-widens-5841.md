---
"@object-ui/plugin-detail": patch
---

`record:activity` no longer widens when its `types` filter cannot be honoured. An
unrecognised or empty kind list used to sanitise to `undefined`, which the filter
pipeline reads as "no filter authored" — so three distinct authored intents collapsed
into one rendering, and the widest one: a page that named the wrong kind was served
every activity on the record, with no diagnostic anywhere at runtime. The principle now
held is that a sanitiser may narrow an author's request or refuse it, but must never
silently widen it; widening turns a typo into "show the user everything", which is the
one outcome no author asked for, and it hides behind a plausible result — a populated
timeline reads as working, an empty one gets investigated.

**Behaviour change.** A page authoring `types: []`, or a `types` list whose every entry
is unrecognised, now renders an EMPTY timeline where it previously rendered every kind.
That is the fix rather than a regression, but a page relying on the old fallback will
visibly change: `types: []` is honoured as "no kinds", and a list that keeps nothing
filters to nothing. A mixed list keeps its recognised entries and drops the rest. Omitting
`types` is unchanged and remains the only way to say "no filter". A `types` that is not a
list at all (`types: 'comment'` — brackets dropped) is likewise refused rather than
ignored, since a filter that cannot be read is not a request to remove the filter.

Unrecognised entries are now named out loud: one `console.warn` listing them and the
declared feed item types, deduped so one bad kind warns once however many times the feed
re-renders, matching the unknown-activity-type diagnostic already in this file. A
well-formed filter stays silent, `types: []` included — there is nothing to report about
a request that was carried out exactly.
