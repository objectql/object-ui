---
"@object-ui/app-shell": patch
---

fix(console): resolve a modal action's `target` as a page, not an object (#3530)

Submitting a `type: 'modal'` action failed with "Error loading form — Bad
Request". The console read the action's `target` as an OBJECT name and opened a
create form for it, so a target naming a page issued `GET
/meta/object/<page>` — which 400s — and the dialog rendered `<ModalForm>`'s
error state instead of the page. Every modal action in an app hit this; the only
workaround was re-authoring each one as a screen flow.

The spec is explicit that for `type: 'modal'`, `target` is "the modal/page name
to open".

- `normalizeModalSchema` no longer guesses "object" for a string target. It
  records the raw name and `useActionModal.resolveModalTarget` (new) resolves it
  against metadata: **page first**, then object for back-compat. Resolution uses
  `getItem(type, name)`, a single-item fetch, so it never eagerly loads the lazy
  page/object lists — this hook is mounted at the console root.
- The `create_x` / `edit_x` prefix convention still yields an object form, but
  now only as a fallback: a page actually named `create_opportunity` wins over
  the object `opportunity` the name would otherwise be parsed into.
- A target that names neither reports what is wrong ("Modal target "x" matches
  no page or object") instead of surfacing a downstream HTTP error.

Modal dispatch is also now the same on every console surface. `type: 'modal'`
was wired straight to the server-action POST in `useConsoleActionRuntime` (list
pages, SDUI pages, the declared-actions bar) while `RecordDetailView` opened
modals client-side — the same button did two different things depending on where
it was mounted. Both now run one rule: render `target` when it names a page or
object, otherwise complete the action through its server-side handler, so a
modal action bound to `engine.registerAction(...)` keeps working.
