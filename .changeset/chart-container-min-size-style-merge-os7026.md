---
"@object-ui/plugin-charts": patch
---

`ChartContainer`'s min-size fallback survives a consumer-supplied `style` (objectstack#7026)

The container wrote `style={{ minHeight: 280, minWidth: 0, ...props.style }}` and
then spread `{...props}` on the line BELOW it. `props` is the rest of
`ComponentProps< "div" >` — only `id`, `className`, `children`, `config` and
`disableSettleRemount` are destructured out of it — so it still carried the
consumer's `style`, and a later JSX attribute of the same name replaces an earlier
one outright. Any caller that passed a `style` therefore replaced the whole object:
both `minHeight` and `minWidth` vanished, and the `...props.style` merge written
inside it never executed even once. It was dead code that read, to anyone auditing
the file, as if the fallback were guaranteed.

That fallback is not decorative. It exists so Recharts' `ResponsiveContainer`
always has a non-zero box to measure: a dashboard widget that overrides the
container's `h-[350px]` class and wraps the chart in flex/grid without an explicit
child height leaves the box at 0, Recharts measures `width/height = -1`, and the
chart renders invisibly — the exact failure the guard was added for.

`style` is now destructured out of the rest props and merged explicitly, so which
side wins is stated in code instead of being decided by JSX attribute order, and
`{...props}` can no longer reach `style` at all.

Precedence: **an author's explicit size wins.** Simply spreading `{...props}`
first and merging unconditionally would have traded this bug for its mirror image
— `minHeight: 280` injected next to an authored `height: 100` floors that 100 to
280, silently overriding the author. So each half of the fallback applies only
when the consumer style declares neither of its own keys: `height`/`minHeight`
gate the height half, `width`/`minWidth` gate the width half, and a key present
but set to `undefined`/`null` counts as not declared. Every other consumer style
key passes through untouched.

Behaviour change surface, deliberately narrow. A caller that supplies no `style`
is byte-for-byte unchanged. A caller whose `style` declares a height — which today
is the only shape in the tree, `AdvancedChartImpl`'s `containerProps` forwarding
`ChartConfig.height` — keeps exactly the height it authored, also unchanged, and
additionally regains the `minWidth: 0` half. What changes is the case the issue
was filed for: a `style` carrying no size key (a margin, a padding, an
aspect-ratio, any future container-level presentation prop routed through the same
`containerProps` path) now keeps the min-size fallback instead of silently
stripping it.

Pinned in both directions, since a one-sided pin would have been satisfied by the
mirror-image fix: a non-size `style` keeps `min-height: 280` / `min-width: 0`
(red before this change), and an explicit `height: 100` renders as 100 with no
`min-height` floor (red under the unconditional-merge alternative).
