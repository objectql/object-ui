---
---

Test-only (no release). `ObjectMap.contractEnvelope-6839` and
`ObjectTimeline.contractEnvelope-6839` each waited on something that could not
fail: the map's absence-shaped wait was satisfied by a mount that never showed
the loading panel and by a `setData` that had not committed yet, and the
timeline's `data-item-count` not-null clause was inert — `getByTestId` throwing
was the whole gate, so `"0"` satisfied it. Both waits now observe the
transition and gate on a settled row count. No package source changed.
