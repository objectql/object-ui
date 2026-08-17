---
---

Test-only plus an AGENTS.md note (objectui#3866). The "no pack reintroduced a
parenthesised plural marker" guard in
`packages/i18n/src/__tests__/marketplace-preview-namespace-3546.test.tsx` matched with
ASCII `\w`, which is `[A-Za-z0-9_]` in JS with or without the `u` flag, so it could not
match a Cyrillic, Arabic or CJK letter: the loop was constant-false for zh/ja/ko/ru/ar
and only ever guarded de/fr/es/pt. It now matches with a Unicode property class and
records the counter-example that separates the two spellings. No locale value and no
published behaviour changes — the five packs' current values carry no marker, so the
restored guard passes on today's packs and starts failing if one is introduced.
