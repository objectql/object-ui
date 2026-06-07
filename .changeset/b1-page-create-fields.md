---
"@object-ui/app-shell": minor
---

Studio: the "New page" form can now create a record page bound to an object.

The page create form was identity-only (label/name/icon/description), so it couldn't make a `pageType: 'record'` page or bind it to an object — even though the page edit form and protocol schema fully support those fields. Mirror the `view` resource's create config: the page create form now exposes **Object**, **Page type** (default `record`), and **Kind** (`full`/`slotted`), so a record page can be created and bound in Studio (#1541). The block layout is then composed in the editor's PagePreview canvas.
