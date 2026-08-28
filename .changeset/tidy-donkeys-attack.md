---
"@object-ui/plugin-form": patch
---

`navigateOnSuccess` now honours a mounted host, and says so when its destination is refused

`ObjectForm` and `WizardForm` consume `navigateOnSuccess` through
`resolveSuccessNavigate`, and both arms travelled to an accepted destination with a bare
`window.location.assign`. A rooted path such as `/apps/x/o/record/{id}` assigned that way
resolves against the ORIGIN root, so under a host mounted at a sub-path (the framework CLI
configures one for every embedded deployment) an authored in-app destination left the
application. Both arms now route an app-relative destination through the injected
navigation seam both components already held for `submitBehavior.url`, so a mounted host's
basename is applied. With no host seam the behaviour is byte-for-byte what it was — a host
with no router has no basename, so origin-rooted resolution is already correct there. A
same-origin ABSOLUTE destination also keeps browser-level navigation: the seam's declared
input is an application-relative path, and an author who spelled out a whole address asked
for that address.

A declared `navigateOnSuccess` whose destination is refused — a mistyped value, or a written
record carrying no usable id — used to produce a success toast identical to the one a form
with no `navigateOnSuccess` produces, so the navigation failed with nobody told. That toast
now carries a note that the declared navigation did not happen, and the template the author
wrote is logged for them. The write genuinely succeeded, so this stays a success rather than
becoming an error state.

Which destinations are ACCEPTED is unchanged: the same-origin guard, the `{id}` /
`{recordId}` dialect and the unescaped interpolation are the subject of an open contract
question and are deliberately untouched here.
