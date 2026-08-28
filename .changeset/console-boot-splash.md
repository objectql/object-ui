---
'@object-ui/console': patch
---

fix(console): paint a boot indicator during the pre-React white frame

The console's `index.html` shipped an empty `<div id="root">`, so a hard
navigation showed a pure-white page until the module graph had downloaded,
evaluated and resolved the two round trips `main.tsx` awaits before
`createRoot().render()`. Measured on this repository's production build with
Playwright + CDP screencast (frames classified pixel-by-pixel, corroborated by
the Paint Timing API): 1224-2016 ms of pure white on an unthrottled localhost,
2289-2297 ms at 20 Mbps/80 ms RTT, and 5808-6167 ms on a Fast-4G profile.

The document now carries the indicator itself — an inline style block and the
same gradient tile `LoadingScreen` opens with — so it paints from the HTML
parser, before the first chunk is requested. It is removed on React's first
commit into `#root`, so it never doubles up with `LoadingScreen`, which
continues to own the init screen and its ten-language copy.
