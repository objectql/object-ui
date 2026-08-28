---
'@object-ui/plugin-gantt': patch
---

The package README stops documenting a `navigation` key the spec refuses, and the corrected example is now parsed by the schema that validates it.

`README.md`'s record-navigation override read
`{ mode: 'page', basePath: '/console/apps/.../campaign' }`. `basePath` is not a
member of the spec's `NavigationConfig`, and nothing consumes it:
`useNavigationOverlay` — where a gantt's `navigation` lands — builds no URL out
of the config, and `ObjectGantt` calls the hook with no `onNavigate`, so a
page-mode click falls through to the host's `onRowClick`. The destination route
is owned by the host and was never authorable through this key, under any
spelling.

That made the snippet worse than inert. `NavigationConfigSchema` is a strict
object with no passthrough, so the undeclared key did not fall away quietly — it
rejected the **whole** config with `unrecognized_keys`, taking down the
`mode: 'page'` the sentence was actually teaching. An author who copied the
documented snippet got a rejected navigation config and no page navigation, which
is the copy-the-snippet-get-rejected shape objectui#5057 / #5012 named on other
keys.

The example is corrected to `{ "navigation": { "mode": "page" } }` — the shape
the sentence demonstrates — and the prose now says who owns the destination route
and points at `@objectstack/spec`'s `NavigationConfigSchema` for the member list
instead of restating it, matching the derivation `ObjectGanttSchema.navigation`'s
doc comment (objectui#5903) adopted for the same concept.

`view` is **not** substituted for `basePath`. It is a declared member, but it
names a form view (the spec: *"Name of the form view to use for details"*) and is
forwarded to `onNavigate` as the action argument — it is not a route, so putting
it where `basePath` stood would have replaced an invented key with a wrong one.
It is documented for what it does.

No gate in this repo could have caught the original defect, and that is why the
fix ships with a measurement rather than a re-reading: `check-doc-snippet-types`
compiles `ts`/`tsx` fences and `check-doc-component-types` reads `type` literals,
and both are structurally blind to a metadata key in a README — the former's own
header records schema-key validity as "a different question … left unruled on
purpose". `src/readme-navigation-example.test.ts` closes that hole for this
example by EXTRACTING the fence from the README on every run and parsing it
against `NavigationConfigSchema`, with a control asserting the same parse still
rejects an undeclared key by name, so the green cannot come from a schema that
accepts everything.

`tsconfig.test.json` names `node` in `types` for that test to compile, and its
comment — which had recorded that no test in this package touches a Node global
— is corrected rather than left standing.
