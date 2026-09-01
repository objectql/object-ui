---
---

Comment-only fix, no release: thirteen comments across ten files described the
tail of `dependentValues ?? ctx.formValues ?? ctx.data ?? {}` as a live channel
a host could supply. It is not one, and never has been.

`SchemaRendererContextType` (`packages/react/src/context/SchemaRendererContext.tsx`)
declares exactly `dataSource`, `debug`, `debugFlags` and `apiFetch`, and
`SchemaRendererProvider` accepts no other prop. There is no `data` member and no
`formValues` member, so that tail is **unconditionally empty in production** —
unsettable rather than merely unset, because no host can populate a member the
type does not declare. `dependentValues` is today the only channel that can
carry a record.

The corrected comments now state what is measured. The strongest of them claimed
the fall-through reached "the OUTER page's record"; another credited
`dependentValues` with a context fallback that only `dataSource` actually has;
a third framed the chain as three suppliable links when only the first has ever
been suppliable. Two of the thirteen were written the same day this was
measured, so they were wrong when written rather than gone stale.

No runtime, type or test behaviour changes: the reads themselves are left
exactly as they are, and the diff contains zero non-comment lines. Whether the
channel should be made real or retired is the open question on objectui#7206 and
is deliberately not answered here.
