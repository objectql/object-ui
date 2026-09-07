---
---

Docs-only fix: `alert-dialog.mdx` and `sheet.mdx` published `trigger`/`content`
node slots as required; the shipped `AlertDialogSchema`/`SheetSchema`
declarations (and their Zod mirrors) already declare them optional. No
declaration changes; test-only update to the fixture pin that records this
class of divergence.
