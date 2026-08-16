---
'@object-ui/types': patch
---

`DashboardWidgetSchema`: stop re-typing the retired `responsive` key as `any`

`dashboard.widgets[].responsive` was retired in `@objectstack/spec` 17.0.0-rc.6
(objectstack#4876, ADR-0049 D2), and objectui's Zod twin — which derives every
spec key by reference — has refused it ever since. The TypeScript interface did
not follow: `responsive` was held out of the inherited key set by an `Omit` and
re-declared as `any`, so one key was accepted by tsc and rejected by validation.

Authoring `responsive` on a widget is now a tsc error, matching the Zod tombstone
that already refuses it. The key inherits as `?: never`, the same way the four
keys objectstack#5010 retired do.

The `any` was deliberate and carried a written reason — that objectui's renderer
reads a per-breakpoint record the spec's single object could not express.
objectui#3173 measured that claim and it was false: there are no
`widget.responsive` read points in the repo and no authored occurrences in either
corpus, so nothing migrates. Breakpoint behaviour is unaffected — the shared
`ResponsiveConfig` shape stays live on `page.components[].responsive`, which
`useResponsiveConfig` really does read.
