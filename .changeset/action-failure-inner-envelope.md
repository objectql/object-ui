---
"@object-ui/app-shell": patch
---

fix(actions): a failed server action no longer reports as success (green toast) — objectstack#3913

`useConsoleActionRuntime.serverActionHandler` — the console's **main** action
path (list toolbars, row actions, page actions) — decided success from
`res.ok` and the OUTER envelope only:

```ts
if (!res.ok || (json && json.success === false)) { /* failure */ }
```

A server older than objectstack#3913 reports a handler failure as HTTP **200**
with the failure nested one level down:

```json
{"success":true,"data":{"success":false,"error":"Action 'log_call' on object '*' not found"}}
```

Both guards pass, so the action was reported as completed: the ActionRunner
fired its green "completed" toast, the list refreshed, and the real error was
swallowed. `RecordDetailView`'s copy of the same handler already inspected the
inner envelope; the shared runtime now does too, and the marketplace install
call (`marketplaceApi.installPackage`), which had the identical hole and could
report a package as installed when it was not.

Current servers answer a failed action with a real HTTP status, which `!res.ok`
catches first — the inner-envelope check is what keeps the console honest
against a runtime that has not been upgraded yet.

**Also fixed:** with objectstack#3913 the failure body is
`{success: false, error: {message, code}}`. `RecordDetailView` read `json?.error`
raw and would have handed that **object** to `toast.error()` as a React child,
crashing the page (React #31) — the exact failure the console runtime's
`errorDetail` helper existed to prevent. That helper is now a shared util
(`utils/actionErrorDetail`) and both call sites go through it, so a nested
`{message}` always resolves to a string.
