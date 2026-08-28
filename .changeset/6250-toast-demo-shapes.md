---
---

Docs and fixtures only: the seven `components-feedback-toast/*` and seven
`components-feedback-sonner/*` `SchemaExample` fixtures hung an action object off
`onClick` (`{"type":"button", …, "onClick":{"action":"toast", …}}`) — a shape
`ButtonSchema` declares as a FUNCTION and no dispatcher reads, so all fourteen were a
RED `safeParse` on the envelope and clicking the rendered demo raised no toast
(objectui#6250). They now author the registered spellings the engine already executes,
`type: 'toast'` and `type: 'sonner'`, whose renderers draw their own trigger button and
call sonner's `toast()` from it. `feedback/toast.mdx` and `feedback/sonner.mdx` follow,
including two keys sonner's page taught that neither `SonnerSchema` declares nor its
renderer reads (`duration`, `action`).

No package source or behaviour change; fixtures, docs and pins only. Two things the
fixture correction deliberately does NOT do, both left to the maintainer: declare an
action union on `ButtonSchema.onClick` and build a dispatcher for it, and give the toast
renderers the in-toast action button and promise form the removed demos implied.
