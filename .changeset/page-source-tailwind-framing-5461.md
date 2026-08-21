---
'@object-ui/types': patch
---

`PageSchema.kind`'s TSDoc names the real per-tier styling primitive for source-authored pages instead of the "HTML + Tailwind" framing ADR-0080's own amendment retracted.

This is a published type surface: the TSDoc ships in `@object-ui/types`'s built
`.d.ts` and is what an author reads on hover over `kind`. It said a `kind:'html'`
page is "constrained JSX/HTML + Tailwind" — and it links
`content/docs/guide/react-pages.md`, which objectui#5413 has already corrected to
say the opposite. Shipped type documentation was contradicting the guide it points
readers to.

ADR-0080's header amendment (2026-06-30, under ADR-0065, Accepted) supersedes that
framing on styling: a page's `source` is *runtime metadata*, the console's Tailwind
is compiled at build time by scanning the console's own `src`, and there is no
safelist — so an authored utility class produces CSS only by coincidence, when
objectui already ships that exact class, and otherwise produces nothing with no
error anywhere. That is the ADR-0065 failure mode verbatim ("works only by
coincidence"), and it is how a modal's `bg-black/50` backdrop reached production
fully transparent.

The tiers themselves are unchanged, and every load-bearing claim in the TSDoc
survives verbatim — parse-never-execute and untrusted-author safety for `html`,
the deprecated `'jsx'` alias, EVALUATED-in-the-main-tree with no sandbox behind the
`react-pages` host capability for `react`, the ADR-0080 citation and the guide
link. Only the styling conclusion changes, to the primitive each tier actually has:

| `kind` | Style with |
|---|---|
| `"html"` | The blocks' own structured props (`` `<flex direction gap>` ``, `` `<grid columns>` ``) plus a JSON `style` object. |
| `"react"` | Inline `style` objects. |

Colors on both tiers come from the theme as `hsl(var(--token))`, so a page follows
light/dark and whatever theme the deployment installs. The TSDoc now also names the
rule that reports a violation — `page-source-className-tailwind`, shipped in
`@objectstack/lint@11.5.0` as `validatePageSourceStyling` and reported by
`os validate` as a warning on both tiers.

No behaviour change, and the accepted `kind` set is untouched.

`packages/components/src/renderers/layout/react-page.tsx` carries the same
correction on its two source comments (the injected-scope note and
`buildComponentScope`), and gains the styling note the file was missing. Those are
internal comments — they do not project into any `.d.ts` and change no export — so
they get no entry of their own; there is nothing an `@object-ui/components`
consumer could read in a CHANGELOG and act on.
