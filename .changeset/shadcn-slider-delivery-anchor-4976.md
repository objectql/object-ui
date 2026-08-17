---
---

Tooling + test-only (objectui#4976). The declared shadcn local patch
`slider-thumb-aria-delivery` is re-targeted at the line upstream actually serves, so
`pnpm shadcn:check` stops reporting it as unappliable and a future `pnpm shadcn:update`
can re-apply it instead of refusing to write.

The anchor as first declared named the line that forwarded the host's accessible name
onto the slider thumb — a line objectui added by hand in commit `a014bc00c`, never a line
the registry has served. Upstream renders the thumb with a class list and nothing else,
which slider's own `localEdits` entry in `shadcn-components.json` had recorded all along.
So the anchor matched the file on disk and could not match upstream: the first weekly
check after it landed reported `found 0x` while the shipped primitive was perfectly
correct. Only the anchor moved; the patch payload, and therefore every byte of
`packages/components/src/ui/slider.tsx` and its behaviour, is untouched — the file is not
edited by this change at all.

The test fixture that hid it is replaced with the registry's verbatim bytes, and the new
assertion is the one that generalises: applying the declared patches to those bytes must
reproduce the shipped primitive byte for byte. An anchor invented from the local file
cannot satisfy that, so the class of mistake is now caught offline on every PR rather
than by the next weekly sync. No published package changes, hence "no release".
