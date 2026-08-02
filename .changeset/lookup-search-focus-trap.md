---
"@object-ui/console": patch
"@object-ui/components": patch
---

Lookup search inside a create/edit modal is typeable again (objectui#3183).

In every production console build, the search input of a lookup field's
quick-select popover — and the nested Record Picker dialog — could not take
focus while the form modal was open: every click/focus was synchronously
yanked back to the field trigger, so a lookup could not be searched while
creating a record.

Root cause is a race in stock `@radix-ui/react-focus-scope@1.1.16`: the
focus-scopes stack effect's cleanup schedules `focusScopesStack.remove(scope)`
in a `setTimeout(0)`. When the effect re-runs for a still-mounted scope (a
`container` ref flicker), the re-run re-`add`s the scope and the stale timeout
then evicts it — the dialog's trap listeners stay active but its scope is no
longer in the stack, so an opening popover pauses nothing and the trap yanks
focus out of the popover forever.

Fixed via `patches/@radix-ui__react-focus-scope.patch`: an effect re-run for a
live scope cancels the pending eviction; a real unmount still runs the full
delayed cleanup (autofocus-on-unmount + stack removal). Regression-tested in
`packages/components` with a deterministic reproduction of the race.
