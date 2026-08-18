---
'@object-ui/fields': minor
---

fix(fields): render the option colour an author declared as an explicit hex, instead of quantizing it to nine palette families (objectui#5141)

`options[].color` accepts any hex, but the badge renderer answered a lossy
question with it: `hexToPaletteName` bucketed the value by hue into nine
families (`red`/`orange`/`yellow`/`green`/`blue`/`indigo`/`purple`/`pink`, plus
`gray` below 22% saturation), and `BADGE_COLOR_MAP` held exactly one class set
per family. Two tiers an author declared as distinct therefore rendered
byte-identical: `#2ecc71` ("in progress") and `#1e8449` ("completed") differ by
0.1 degree of hue, both landed in `green`, and both emitted
`bg-green-50 text-green-700 border-green-200`. Pressing the second colour darker
still changed nothing. End users could not tell the two states apart in a list.

`plugin-gantt` had already settled this class of conflict the other way —
*explicit colorField value (hex or semantic name) — metadata wins* — and
Studio's own option editor paints the author's swatch straight from the raw hex.
Badges were the odd surface out.

Now an explicitly declared hex is rendered as declared: the soft-pill surface,
label and border are derived from that hex rather than snapped to a family, for
both `appearance: 'badge'` and `appearance: 'dot'`.

Two properties the family maps gave us for free are kept deliberately:

- **The design system keeps control of theming.** The derived colours are
  published as CSS custom properties and consumed by *static* Tailwind
  utilities, so light and dark remain ordinary `dark:` variants
  (`.dark\:bg-...:where(.dark, .dark *)` in the built sheet) rather than a
  hard-coded inline background that would render identically in dark mode.
  Tailwind cannot generate a class for a runtime value, so the custom property —
  not the colour — has to be the dynamic part.
- **Contrast is pinned, not just colour identity.** The label is the lightness
  along the declared hue nearest the declared one that still clears WCAG AA
  (4.5:1) against the surface actually rendered. Authors can and do declare
  colours that are unreadable under a label; honoring the declaration must not
  turn legibility loose across every list view. Dots are held to 1.9:1 against
  the row, the measured floor of the `-500` shades shipped today.

**What changes for an author relying on the current look:** every select/status
badge whose option colour is declared as a hex — which the renderer's own notes
describe as almost all of them — will render in that declared colour rather than
its palette family's fixed pill. Colours near a family's canonical shade look
much as before; a colour the author picked deliberately *away* from it (a deep
green, a muted red) now looks like what was written, and the pill's depth tracks
the declared lightness. Declarations that are not an explicit hex are untouched:
family names, the semantic value map and the deterministic hash fallback all
resolve exactly as they did, and `getSemanticColorName` still returns family
names, so the Gantt path is unaffected.

The badge classes exported by `getBadgeColorClasses` are unchanged, so callers
that consume only a class string (the grid's compact card view and group-header
pills, Kanban) keep today's quantized rendering until they adopt the new
`getBadgeHexAppearance` / `getDotHexAppearance` helpers.
