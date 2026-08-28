---
'@object-ui/plugin-chatbot': patch
'@object-ui/app-shell': patch
---

Confirm-replay dispatch errors (bare `{error: …}` envelopes) now resolve the 确认修改 card instead of leaving it on 应用中 forever: `detectReplayOutcome` classifies them as a provisional failure, and a later successful authoring result in the same turn (the model self-repairing, e.g. after an `object not found` on a blueprint-local name) supersedes it via `detectAuthoringVerdict` — so the card never says 未生效 over a change that actually landed. Real publish failures (`publishFailed` envelopes) are never superseded. Measured live on the local rig, 2026-08-24.
