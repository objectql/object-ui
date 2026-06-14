---
"@object-ui/plugin-markdown": minor
"@object-ui/console": minor
"@object-ui/i18n": patch
---

Docs: mermaid diagrams + long-doc table of contents (ADR-0046).

- **plugin-markdown** renders ```mermaid fenced blocks as diagrams (`<Mermaid>`: lazy-loaded mermaid, `securityLevel: 'strict'`, rendered post-`rehype-sanitize` by a trusted component, degrades to the raw source on error). Mermaid is text → SVG, so it stays within the v1 image/binary ban. Adds `extractToc(markdown)` — a TOC builder whose slugs are generated with the same `github-slugger` `rehype-slug` uses, so `#id` links resolve to the rendered heading anchors.
- **console** `DocPage` shows a sticky right-rail table of contents (h2–h3) for docs with ≥3 headings, plus an app-independent `/apps/:packageId/docs` index already added earlier.
- **i18n** adds `help.onThisPage` (en/zh; other locales fall back).
