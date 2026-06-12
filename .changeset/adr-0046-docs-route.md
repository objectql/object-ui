---
"@object-ui/console": minor
---

ADR-0046 P2: `/docs/:name` package-documentation route.

One authenticated route renders any installed `doc` metadata item (flat Markdown docs compiled from a package's `src/docs/*.md`): fetches the item via the standard metadata API (`meta.getItem('doc', name)`), renders the sanitized body through `@object-ui/plugin-markdown`, and rewrites relative cross-references `[x](./other_doc.md#anchor)` → `/docs/other_doc#anchor` (fenced/inline code untouched, SPA navigation on click). Unknown names degrade to a "Documentation not found" notice per the ADR — never a hard failure.
