---
'@object-ui/console': patch
---

Public form `/f/:slug` renders its authored `title` and `description` instead of the
object API name (objectui#8408).

The one Console surface an **unauthenticated** visitor sees greeted them with a
database table name. `GET /api/v1/forms/:slug` serves the authored copy intact
(`{"object":"ats_inquiry","form":{"title":"Apply","description":"…"}}`), and the page
rendered `ats_inquiry` as its `<h1>` with nothing at all where the description belongs.
Found taking release screenshots of a real app on this Console (ats#59), in a real
browser, in both `en-US` and `zh-CN`.

Two independent read-side defects, one payload, no server change:

- **`loadPublicForm`'s fallback chain** was `payload.label ?? payload.form?.label ??
  payload.object`, and every arm missed but the last. The public resolver sends no
  envelope `label`, and `form.label` is a key `@objectstack/spec`'s `FormViewSchema`
  **rejects** (`unrecognized_keys`) — a form config carries `title`. So the one real,
  typed, populated key naming the form was the only one never read. `form.title` now
  sits ahead of the API-name arm, and ahead of the rejected `form.label` spelling so
  that key can never outrank it. `payload.label` keeps its precedence: the fallback
  ORDER changed, not which value wins where one already did.
- **The subtitle slot** read `form.label` guarded by `form.label !== loaded.label`, a
  predicate that was **dead** on this route in both directions — with no `payload.label`
  the two operands are the same value, and with one `form.label` is undefined. It now
  renders the form's `description`, which arrives in the payload untouched and which the
  whole file previously never read once.

Section labels on this route are still rendered raw; that is a separate seam, tracked
on its own card.
