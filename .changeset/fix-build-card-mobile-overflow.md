---
"@object-ui/plugin-chatbot": patch
---

fix(plugin-chatbot): build-result summary truncates on mobile instead of overflowing (#2493)

The draft-review card's summary line (`built N artifact(s) — …`) is a nowrap
`truncate` span, but its flex row lacked the `min-w-0` that lets `truncate`
actually bite — so on a phone the long summary expanded the chat column past
the viewport and the whole chat scrolled sideways. The span now gets
`min-w-0 flex-1` (truncating within the row) and the action row is `flex-wrap`
so its buttons drop to a new line on a narrow screen rather than forcing
horizontal scroll. Desktop is unchanged (there's room, so nothing wraps or
truncates).
