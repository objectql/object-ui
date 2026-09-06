---
'@object-ui/app-shell': patch
---

Studio package lookup now renders a producer-marked `error.userMessage` from the failure
envelope, preferring it over the diagnostic `error.message`.

`fetchFullPackage` — the `/api/v1/packages` read behind "Package info & settings" and the
managed-snapshot refresh — read only `error.message` and `error.code`. In the 5xx band the
platform withholds the producer's prose and substitutes the generic `Internal server error`
into `message`, while the marked `userMessage` rides through untouched, so an author met a
500/503 that carried a sentence written for them and was shown the generic one instead.
Per the envelope contract, presence of `userMessage` IS the producer's marking and a
consumer that sees it renders it verbatim; `error.code` still travels alongside, and an
unmarked refusal is unchanged.
