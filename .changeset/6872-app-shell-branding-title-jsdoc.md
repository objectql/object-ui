---
'@object-ui/layout': patch
---

Correct the `AppShellBranding.title` doc comment (objectui#6872). It read "Page title
suffix (sets document.title)" while `useAppShellBranding` assigns `document.title = title`
wholesale — nothing is appended; the caller composes the whole string (the console passes
`"App label — Product name"`). That comment ships in `dist/index.d.ts` and is the only
description a consumer sees on editor hover, so a reader who followed it passed a
suffix-only fragment and got a truncated title with no error. The comment now carries the
same wording as `content/docs/layout/app-shell.mdx`, and agrees with the `AppShellProps`
tables in the package README and `content/docs/guide/layout.md`. No runtime behaviour
changes; the wholesale assignment and the four-surface agreement are now pinned by tests.
