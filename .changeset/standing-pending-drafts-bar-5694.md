---
'@object-ui/app-shell': minor
---

AI build surface gains a standing 「未发布改动」 bar (#5694): while the conversation's bound package has pending drafts, a bar floats above the composer — surviving scrolling — counting the unpublished changes and publishing them through the same governed `publish-drafts` route as the inline card button, with probe findings surfaced instead of a blind success toast. Renders nothing when the count is zero or the conversation is unbound.
