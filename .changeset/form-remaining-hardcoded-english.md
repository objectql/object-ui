---
'@object-ui/components': patch
'@object-ui/i18n': patch
---

The form renderer's last user-visible English literals now go through i18n (#3272). The fullscreen long-text editor (`mobile_fullscreen`) was an entire untranslated dialog — title, screen-reader description, `Cancel` / `Done` footer buttons, and the expand trigger's accessible name — rendering English inside an otherwise translated zh/ja/ar form; it now reads the new `form.fullscreen.*` keys, shipped in all ten locale packs.

**Behaviour change worth reading if you author forms:** `submitLabel` and `cancelLabel` no longer default to the literals `'Submit'` and `'Cancel'` in the renderer. They default to *unset*, and the action bar falls back at render time to `common.submit` / `common.cancel`, so a form that declares no button copy now follows the session language instead of being silently frozen to English. A label you DO declare still wins verbatim in every locale — including an English one under a zh session, and including an explicit empty string (the fallback uses `??`, so `submitLabel: ''` renders a blank button rather than being overwritten). The only forms whose rendered text changes are those that never declared the labels and are viewed in a non-English session — which is the bug. `FormSchema.submitLabel` / `cancelLabel` stay optional strings; no spec or type change.

Also removed the built-in `select` branch's second `|| 'Select an option'` fallback. The single call site already supplies `t('common.selectOption')`, so the literal was reachable only through an authored `placeholder: ''` — where it replaced the author's deliberate blank with an untranslated English word.
