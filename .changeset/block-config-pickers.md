---
"@object-ui/app-shell": minor
---

Schema-driven object/field pickers in the page-editor block inspector. Data-reference block properties are now dropdowns populated from the live metadata instead of free-text: an object picker (e.g. `record:related_list` object, `element:number` object) and cascading field pickers that list the chosen object's actual fields (e.g. `record:related_list` relationship field, `element:number` field, `record:path` status field, `record:highlights`/`record:details` field lists). Resolves the object from the record page's bound object or a sibling block property; degrades gracefully to a text input when the metadata can't be fetched.
