---
"@object-ui/app-shell": patch
---

fix(actions): one source for the `/actions` envelope rule, and `redirectUrl` finally works (objectstack#3913 follow-up)

The `/actions` response wraps **twice** — the route's own `{success, data}`
inside the dispatcher's — and a failure has three shapes, only one of which
`res.ok` catches. That rule was hand-rolled in two places
(`useConsoleActionRuntime.serverActionHandler` and `RecordDetailView`'s copy of
the same handler), and the two drifted. Four hand-rolled copies produced three
distinct bugs:

1. **A failed action reported as success** — the copy that didn't inspect the
   inner envelope was the console's *main* action path, so a failure fired the
   green "completed" toast on every list and page surface (fixed in #2963).
2. **React #31 crash** — the nested `{message, code}` object handed to
   `toast.error()` as a React child (fixed in #2963).
3. **`redirectUrl` never fired** — *fixed here.*

Both handlers now call `interpretActionResponse` from `utils/actionResponse`,
and a ratchet test (`actions-envelope.ratchet.test.ts`) fails if a third
hand-rolled copy appears.

## `redirectUrl` was unreachable

A script action can return `{ redirectUrl: 'https://…' }` to ask the console to
open a URL. Both handlers read it off `body.data` — the **action** envelope,
one level too shallow:

```
{ success: true, data: { success: true, data: { redirectUrl: '…' } } }
                 ^^^^ read here          ^^^^ actually lives here
```

`body.data` is constructed by the server and only ever holds `success` / `data`,
so `body.data.redirectUrl` was **always** undefined — the convention could never
fire, and no handler could work around it. An `opensInNewTab` action was worse
than a no-op: it pre-opens a tab on a spinner page for popup-blocker safety, and
with no redirect to drive it to, that tab sat on the spinner forever.

`ActionResult.data` still carries the **action envelope**, unchanged — some
`resultDialog` field paths in the wild may have adapted to that depth, so it is
not silently re-pointed here.
