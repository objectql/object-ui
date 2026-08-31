---
---

Documentation-only: `content/docs/guide/console-architecture.md`'s Branding section now points
readers at the tokens branding actually acts through, instead of at the backward-compat alias.

The section's one closing sentence read "This sets CSS custom properties (`--brand-primary`,
`--brand-primary-hsl`, etc.) on the document root" — naming only the `--brand-*` group. That
group is an alias: `useAppShellBranding` writes it, nothing in this repository reads it, and no
Tailwind utility is wired to it. The properties that make a brand colour visible are the Shadcn
theme tokens the same hook writes — `--primary` / `--primary-foreground` / `--ring` /
`--sidebar-primary` / `--sidebar-ring` from `primaryColor`, and `--accent` /
`--accent-foreground` from `accentColor` — which reach rendered output through the Tailwind 4
`@theme` block in `packages/components/src/index.css` (`--color-primary: hsl(var(--primary))`
and siblings), and that is what generates the `bg-primary`, `text-primary-foreground`,
`bg-accent` and `ring-ring` utilities the components already use. A reader following the old
sentence would customize against a name nothing guarantees.

The new copy states the mechanism, then describes the `--brand-*` group as what it is: a
backward-compatibility alias. It also records a difference the old sentence hid — `--brand-*`
carries the authored hex and its light-mode HSL triple and does not follow the light/dark
toggle, while `--primary` / `--accent` carry the mode-adjusted value — so the two are not
interchangeable for anyone theming against them.

Deliberately **not** done here: the four alias properties are not removed and
`packages/layout/src/AppShell.tsx` is not touched. CSS custom properties are consumed by
definition from outside this repository — a customer stylesheet can write `var(--brand-primary)`
directly — so the in-repo grep that found zero readers is structurally incapable of seeing the
consumers that would make removal safe, and zero in-repo hits does not license deletion.
Retiring them needs a measurement that reaches outside this repo (a release-surface
announcement, a deprecation window, a survey of customer stylesheets); that is a separate card.
The prose therefore neither promises removal nor promises permanence, matching the hedge the
source comment already carries.

Every token name and the `@theme` consumption path were checked against
`packages/layout/src/AppShell.tsx` and `packages/components/src/index.css`. No published
behaviour changes and no package source was touched.
