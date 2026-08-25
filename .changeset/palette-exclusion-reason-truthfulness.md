---
---

Corrects two `PALETTE_EXCLUSIONS` reason strings in the Studio page-palette ledger that
claimed "no renderer" for `element:text_input` and `element:record_picker`, both of which
have registered renderers, and pins the class with a test. The exclusions themselves are
unchanged decisions and no published behaviour moves: the reason strings are developer-facing
ledger prose, read by no runtime code path.
