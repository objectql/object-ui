---
"@object-ui/plugin-chatbot": minor
---

feat(plugin-chatbot): honest liveness indicator on running AI turns

AI app builds run 1–3 min with long quiet gaps (LLM thinking, sample-data
generation) where a static spinner is indistinguishable from a dropped
connection. The chat now shows a Claude-Code-style liveness indicator driven by
REAL observed stream activity, not a free-running clock:

- `useTurnLiveness(active, activityKey)` stamps the moment real data arrives (a
  streamed token / tool delta / `data-build-progress` update) and measures
  seconds-since-last-byte.
- `LivenessIndicator` renders three honest states — *receiving* (emerald pulse +
  m:ss, bytes arrived recently), *waiting* (request in flight, nothing back yet),
  and *stalled* (amber + "no response for Ns", genuinely silent past 6s).
- The build panel prefers the server's monotonic `seq` keep-alive heartbeat as
  its activity key (falling back to the content signature on older runtimes), so
  a long quiet seed-generation window reads as honestly *receiving* rather than
  flipping to amber.
