---
'@object-ui/fields': patch
---

fix(fields): translate the registered path's fullscreen long-text dialog (objectui#3404)

`FullscreenFieldEditor` — the expand button and dialog that `TextAreaField`
(`field:textarea`) and `RichTextField` (`field:markdown` / `field:html`) render
when `ObjectFormSchema.mobile.fullscreenLongText` is on — shipped four English
literals: the toggle's accessible name (`Edit {label} fullscreen`), the title
fallback `Edit text`, `Cancel` and `Done`.

No translation was missing. `form.fullscreen.*` and `common.cancel` have shipped
in all ten locale packs since objectui#3272 translated the built-in branch; this
path simply never consumed them. The result was visible inside a SINGLE form: a
zh session saw 「取消 / 完成」 on a built-in-rendered long-text field and
`Cancel / Done` on a registered-widget one.

All four now consume those existing keys — **no new keys, no locale-pack
change**. The dialog also gained the sr-only `form.fullscreen.description` the
built-in branch already carries, so it has an accessible description
(`aria-describedby`) instead of none.

Copy resolves through `useFieldTranslation()` (`createSafeTranslation`), as the
built-in branch does, whose English defaults are byte-identical to the literals
they replace — so widgets rendered with no `I18nProvider` (standalone/embedded
hosts) render exactly what they did before rather than raw i18n keys.
