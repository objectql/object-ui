---
"@object-ui/plugin-list": patch
---

The list toolbar search button now shows the active keyword inline (mirroring
the Sort button's count badge). Previously a search term restored from
localStorage after navigating away and back kept filtering the list while the
search popover stayed collapsed — the only cue was a slightly darker magnifier
icon, so users couldn't tell a keyword filter was still active. The keyword is
rendered (truncated at 8rem) next to the magnifier whenever a search is active,
and clicking it opens the popover pre-filled for editing or clearing.
