---
---

Documentation-only: `content/docs/layout/app-shell.mdx` now describes `branding` and
`rightRail` in prose, not just in the `AppShellProps` key table. The page's Features and
Styling sections had never mentioned either prop — the table half landed with objectui#4808
while the prose was deliberately held back until objectui#4818 ruled on
`AppShellBranding.logo`. That ruling was REMOVE, so the new copy describes the
post-removal surface: the four fields `useAppShellBranding` actually reads
(`primaryColor`, `accentColor`, `favicon`, `title`), which Shadcn theme tokens each colour
writes (`--primary` / `--primary-foreground` / `--ring` / `--sidebar-primary` /
`--sidebar-ring` and `--accent` / `--accent-foreground`), and that `rightRail` renders as
a flex sibling that reflows the content rather than overlaying it (ADR-0057 P3a). Every
sentence was checked against `packages/layout/src/AppShell.tsx` and
`packages/components/src/index.css` rather than against the key table — that is the
failure this page has already been corrected for four times. No published behaviour
changes and no package source was touched.
