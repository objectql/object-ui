---
"@object-ui/react": minor
"@object-ui/data-objectstack": minor
"@object-ui/components": minor
---

fix(form): a server rejection that names fields now marks those fields (objectstack#3896)

The server has always said which field it rejected. `@objectstack/objectql`'s
validators throw `VALIDATION_FAILED` with `fields[]` — one entry per offending
field, each with a human `message` — and both the REST layer and the runtime
dispatcher serve that as a 400 with the entries intact.

Every form dropped them. The submit handler caught the rejection, ran the
message through `extractWriteErrorMessage`, and showed **one undirected toast**:
the user was told something was wrong but not *what*, on a surface that already
knows how to mark an input — and already does exactly that for client-side
validation. On a long form the offending field was often off-screen, so "创建"
appeared to do nothing.

**Now the two failures behave identically, because they share one
implementation.** The per-field marking, the toast naming the fields, and the
scroll-and-focus of the first offender (#2793) were extracted from the
client-side invalid handler; the server path calls the same function. As far as
the person filling in the form is concerned these are the same event — only the
referee differs.

Three layers, each of which was dropping the detail:

- **`@object-ui/react`** — new `extractFieldErrors(err)` (exported alongside
  `extractWriteErrorMessage` / `isPermissionError`) normalises the three shapes
  the error can arrive in: a typed `ValidationError` from the ObjectStack
  adapter, the raw `@objectstack/client` error (whose `details` falls back to the
  whole response body, which is where `fields[]` lands), and a hand-rolled error
  carrying `fields` directly — the server duck-types that shape identically, so
  the client must not be pickier than the server. Entries with no usable `field`
  are **dropped rather than guessed at**: marking an innocent input is worse than
  the generic toast.
- **`@object-ui/data-objectstack`** — `normaliseClientError` now maps a 400
  `VALIDATION_FAILED` onto the `ValidationError` class that has sat in
  `errors.ts` since the package was written, exported and **never once
  constructed**. Its `validationErrors: Array<{ field, message }>` shape was
  already exactly right. `create` also now normalises at all: only `update` did,
  so a rejected insert reached callers as the raw client error — and a create is
  the path that most often trips required-field validation.
- **`@object-ui/components`** — the form renderer maps the entries onto
  `form.setError` and takes over the failure, **but only when every rejected
  field has a visible input to carry it**. If the server also rejected something
  the form does not render, it falls through to the banner, whose top-level
  message concatenates every field's reason — so the part the user cannot see
  inline is still said out loud instead of silently dropped.

This also removes the need for the client-side predicate mirroring added in
#2962: a form no longer has to guess what the server will reject in order to
warn about it beforehand, and mirrored predicates drift.

Non-field failures (403 / permission denials / anything without `fields[]`) take
exactly the path they took before.
