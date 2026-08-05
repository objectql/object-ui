---
'@object-ui/i18n': minor
---

The console language choice now survives a reload. `I18nProvider` writes every language change to `localStorage` (`objectui-locale`, exported as `LOCALE_STORAGE_KEY`) and boots the next session in that language, so switching to 中文/日本語/… is no longer reverted to `en` by the next F5 or new tab (objectstack#5406).

Bootstrap precedence is **stored choice → browser language → `defaultLanguage`**: an explicit choice outranks browser detection, and a stored value the app no longer offers is ignored and purged rather than locking the UI to a locale with no translations. The restore lands in the instance's bootstrap language, so `<html lang>` — and therefore the `Accept-Language` header on the first wave of API calls — is already correct on the first render.

New public surface on `@object-ui/i18n`: `persistLanguage` (default `true`; set `false` for fixed-language previews/demos), `LOCALE_STORAGE_KEY`, and `readStoredLanguage()` for apps that bootstrap their own i18next instance.
