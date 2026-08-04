---
"@object-ui/app-shell": patch
---

RecordDetailView's `type:'modal'` dispatch no longer falls back to the server-side action handler when the target resolves to neither a page nor an object. That fallthrough could never succeed — the framework rejects `type:'modal'` over REST with a 400 (`headlessActionTypeError`) — so it only converted an authoring mistake into a confusing round-trip. The record page now reports the same descriptive authoring error as the shared console runtime (objectstack#3959), naming the action, the dud target, and the way out (`type:'script'` with `params`).
