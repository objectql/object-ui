---
'@object-ui/app-shell': minor
---

Flow builder: live preview for Screen nodes (#1944)

Screen-flow nodes were authored blind — there was no way to see the form an end user would get, and the Debug simulator showed only `paused` when it reached a screen. Add a live preview that renders the screen exactly as it runs.

The runtime `FlowRunner`'s screen body (flat input fields + object-form mode) is extracted into a shared `ScreenView`, so the preview reuses the **same** renderer as runtime and can't drift (the design↔runtime divergence #1927 fixed). A new `ScreenPreview` builds a `ScreenSpec` from the node's authored `config` and feeds it to `ScreenView`.

- Reflects `title`, `description` (with `{var}` interpolation), input `fields`, and object-form mode (`objectName` / `mode` / `defaults`, rendered via `plugin-form`'s `ObjectForm`).
- Updates live as the node config changes.
- Two homes: the **flow node inspector** (interpolates against the flow's declared variable defaults) and the **Debug simulator** when paused at a screen (interpolates against the live simulated run state, replacing the bare `paused`).
