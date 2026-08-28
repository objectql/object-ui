---
---

Test-only change to the console's public-block binding-reach probe: its `sections` fixture sample is now spec-valid (an array of section objects, not a bare string), its `formType` sample is a real form variant, and the crash guard runs ahead of the branch split so it covers every candidate. No published behaviour changes — the renderers are untouched.
