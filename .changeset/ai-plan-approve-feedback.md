---
'@object-ui/plugin-chatbot': patch
'@object-ui/app-shell': patch
---

Plan-card approval gives immediate in-card feedback (#2627): clicking
"Build it" flips the clicked card to a spinning "Building…" badge right away
(the approval's chat-level effects land at the bottom of the thread, outside
the viewport, so the card looked untouched for ~10s and users double-clicked).
The durable Built state still derives from the message stream; an approval
that never left the client (rate limit / offline) rolls the badge back so the
button returns. New `planBuildingLabel` prop (AiChatPage passes zh).
