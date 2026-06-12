---
"@object-ui/plugin-markdown": minor
---

Markdown grammar v1.1 (ADR-0046): heading anchors, code highlighting, and GitHub-style alerts.

The shared markdown renderer now applies three enrichments, all behind the existing `rehype-sanitize` gate (which runs last and stays the final XSS boundary):

- **Heading anchors** (`rehype-slug` + `rehype-autolink-headings`) — headings get slug ids so intra-doc `#section` links resolve (fixes the ADR-0046 cross-reference anchors, which previously had no target). `clobberPrefix: ''` keeps ids verbatim.
- **Code highlighting** (`rehype-highlight`) — fenced code blocks get highlight.js token classes; colors are theme-aware (light/dark) via injected CSS using the console's shadcn variables.
- **GitHub-style alerts** (`remark-github-blockquote-alert`) — `> [!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` render as styled callouts. The syntax is valid CommonMark, so it also renders natively in GitHub previews and degrades to a plain blockquote in any older renderer — no lint coordination needed.

Security posture is unchanged: class names and ids are inert; script/style/event-handler/`javascript:`/iframe vectors stay blocked, and the alert icon SVG is stripped (zero SVG surface in the sanitize schema — callout icons are CSS pseudo-elements). A `class → className` canonicalization step runs before sanitize so the alert plugin's raw `class` attribute survives the whitelist.
