---
'@object-ui/fields': patch
---

AddressField / GeolocationField sub-inputs now derive their DOM ids from a `useId()` prefix + sub-field name (the RadioField / CheckboxesField `groupId` paradigm) instead of hardcoded literals ("street", "city", "state", "zipCode", "country", "latitude", "longitude"). Two address or geolocation fields in one form no longer produce duplicate DOM ids, and each sub-label's `htmlFor` resolves to and focuses its own field's input instead of the first match in the document (#3343).
