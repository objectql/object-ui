---
"@object-ui/console": patch
---

fix(ADR-0046): enable Tailwind typography so Markdown docs render styled.

`plugin-markdown`'s `MarkdownImpl` renders inside `prose prose-h1:text-3xl …`,
but the console never registered `@tailwindcss/typography`, so every `prose`
utility was a no-op — Markdown rendered with no heading sizes, list markers, or
spacing (the `/docs/<name>` page showed its `# Title` at body size, looking
unstyled). Register the plugin (`@plugin '@tailwindcss/typography'`) and add the
dependency. Now doc headings, paragraphs, inline code, and links render with
proper hierarchy.
