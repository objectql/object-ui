---
'@object-ui/console': patch
'@object-ui/app-shell': patch
---

A `type: 'form'` action fired from a record now EDITS that record instead of creating a duplicate

`ActionRunner.executeForm` forwards the record an action was fired from as `/forms/:name?recordId=<id>`, but the console's internal form route never read that param. The only query params it consumed were the `prefill_` ones, so the route rendered EMPTY inputs, and its submit was an unconditional `POST /api/v1/data/:object` — an insert. An "edit this record" action therefore opened a blank form and, on Submit, created a second record while leaving the original untouched. In the showcase app: open any Task, click **Log Time**, fill it in, Submit — a NEW Task appeared. Until objectui#4109 the damage was hidden behind the anonymous "Your submission has been received" panel; once an internal submit started landing on the record it wrote, the duplicate became visible immediately.

`?recordId=` now selects the whole read/write pair. The route loads the record with `GET /api/v1/data/:object/:id`, prefills the inputs with its stored values, and saves with `PATCH /api/v1/data/:object/:id` — the verb the data plugin declares (`plugin-rest-api.zod.ts`), the one `packages/rest` registers, and the one every other update client in this workspace already spells. After a successful save the user lands back on the record they edited.

A `recordId` the route cannot honour now fails closed. A record that 404s or 403s, a payload whose object contradicts the form's target, and a present-but-blank `?recordId=` each render the form's error state; none of them falls back to create mode, because a blank form whose submit inserts a duplicate is this bug's exact harm and silently degrading into it would just re-arm it. A `recordId` naming a record of a different object is not found under the form's own object, so it takes the same refusal path.

When a URL carries both a `recordId` and `prefill_` params, the explicit params win for the fields they name and the record's stored values fill the rest — a producer that forwards both is expressing intent, and the per-field instruction is the more specific one. Stored nulls and empty strings count as real values and beat a field's create-time `defaultValue`, so opening an edit form never silently proposes a change the user did not make.

Two surfaces are deliberately untouched. Create mode — no `recordId` — behaves exactly as before, and the public `/f/:slug` path ignores `recordId` entirely: an anonymous visitor controls the URL, so honouring it there would turn a public form into an arbitrary-record reader and writer. In `@object-ui/app-shell` only the URL-param registry's documentation changed, recording that `recordId` now has a second reader on a route that can never match the same URL as the record drawer's.
