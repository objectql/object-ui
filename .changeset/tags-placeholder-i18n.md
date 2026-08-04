---
"@object-ui/fields": patch
"@object-ui/i18n": patch
---

`TagsField` no longer ships a hardcoded Chinese input placeholder
(objectui#3342, AGENTS.md Commandment #-1). The placeholder now resolves
through the pinned chain: the author-declared `field.placeholder` wins
(previously ignored by this widget); otherwise the widget's own copy arrives
via `useFieldTranslation()` under the new `fields.tags.placeholder` key, added
at full parity across all locale packs (Chinese lives in the zh pack, not in
code); with no `I18nProvider` mounted the English default from FIELD_DEFAULTS
renders — never a raw key.
