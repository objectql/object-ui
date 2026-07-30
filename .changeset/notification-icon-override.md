---
"@object-ui/components": minor
"@object-ui/app-shell": minor
---

fix(notifications): the spec `icon` is read instead of stored and ignored (#3014 follow-up)

`NotificationSchema.icon` — "Icon name override" — reached `NotificationItem` and
stopped there. Every surface drew the severity icon, so an author writing
`icon: 'rocket'` got the success checkmark. Same shape as the `displayType`
collapse #3071 fixed: a value that validates, is carried, and renders nothing.

All five presentations now resolve it through one rule (`notificationIcon`): a
declared Lucide name — kebab-case or PascalCase — replaces the severity icon;
anything else falls back to it. That includes the console's sonner toast, so the
override behaves identically on a toast, a banner, a snackbar, an alert and an
inline message.

**The fallback is the interesting part.** `getLazyIcon` degrades an unknown name
to a `Database` glyph, which is right for a data-shaped schema slot and wrong
here — on an error notification it swaps a meaningful icon for a meaningless one.
So the name is checked first, via a new `isLucideIconName` export, and a typo
costs the author their override and nothing more.
