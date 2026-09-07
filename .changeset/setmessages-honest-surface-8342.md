---
'@object-ui/plugin-chatbot': minor
---

`useObjectChat().setMessages` now keeps the promise its declaration makes, and the
`chatResult as any` that was hiding the gap is gone (objectui#8342).

The member is declared `(messages: unknown[]) => void` and the hook returned
`@ai-sdk/react`'s own `setMessages`, which accepts only its `UIMessage[]`.
Parameters are contravariant, so that assignment is unsound — `tsc` reported it as
a TS2322 the moment the cast came off, and the declared type was telling every
consumer they could hand over an arbitrary array when the function underneath
could not take one. Nothing broke only because no caller had yet taken the type at
its word; one who did got a runtime failure the compiler had blessed.

The parameter stays `unknown[]`. This package does not republish the SDK's pinned
`UIMessage` on its own surface — the same call objectui#8214 made one file over
for `AnyPart.state`, and typing this member against the SDK would re-break it on
the next dependency bump. Instead the hook now wraps the SDK function and checks
every element first: an object with a string `id`, a `'user' | 'assistant' |
'system'` role, and a `parts` array — exactly the three members `UIMessage`
requires. `parts` is checked for array-ness only, because the part union is open
(a `data-*` part carries an author-defined payload) and restating it is the
coupling this change exists to avoid.

**Behaviour change, and the reason this is not a patch.** A value that is not a
chat message is now REFUSED, not filtered and not passed on: the call throws a
`TypeError` naming the offending index, and the SDK's store is left untouched
because the whole array is validated before anything is written. Filtering was
rejected deliberately — this is a re-hydration path where the caller's statement
is "the thread is now exactly these messages", so dropping the failures would
install a shorter thread that the `void` return makes undetectable. The declared
TYPE does not move, so nothing that compiled stops compiling; what narrows is the
set of values a consumer can successfully pass at runtime, which is the opposite
direction from objectui#8214's widen.

`@object-ui/app-shell`'s `useReconcileOnError` is the one in-repo consumer. Its
payload comes from `toUIMessages`, which emits exactly `id` / `role` / `parts`, so
it passes the check unchanged; and it already calls through a `try`/`catch` that
falls back to the ordinary error banner, so a future malformed server payload
degrades to "show the error" rather than to a quietly-truncated transcript.
