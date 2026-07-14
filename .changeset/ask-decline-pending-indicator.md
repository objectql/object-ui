---
"@object-ui/plugin-chatbot": patch
---

Make the ask-decline wait feel responsive: live thinking indicator + handoff card the moment `suggest_builder` lands (#2458 item 3).

When the `ask` agent declines a build-shaped request, the ~20s before the "Open in Builder →" card is dominated by the LLM's time-to-tool-call. During that wait the chat could show dead air — a blank bubble, or the static "执行过程" activity note (a hydrated-history affordance) when the backend streamed a `(called …)` tool-call placeholder.

`ChatbotEnhanced` now shows the existing live thinking indicator (`ThinkingDots`) whenever a streaming assistant turn has nothing visible yet — including whitespace-only content, a mid-stream `(called …)` placeholder, and hidden reasoning in `summary` mode. The static "执行过程" note is reserved for FINISHED (re-hydrated) tool-call-only turns (#772 preserved). The `builderHandoff` card already renders at `output-available` with no gate on the trailing prose, so it surfaces the instant the tool result arrives; the typing cursor now only paints beside real streaming prose (no lone cursor during the tool phase).
