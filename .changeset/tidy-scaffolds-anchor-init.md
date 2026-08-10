---
'@object-ui/cli': patch
---

`objectui init` now versions the project it scaffolds against the CLI that wrote it, and stops writing a `tailwind.config.js` Tailwind 4 never reads.

The generated `package.json` asked for `@object-ui/components` and `@object-ui/react` at `^2.0.0` while those packages publish at 17.x, so `npm install` in a fresh scaffold resolved a major unrelated to the CLI that produced it. Both ranges are now derived from the CLI's own version, which is sound because `.changeset/config.json` releases the CLI and every platform package from one `fixed` group. The scaffold's toolchain ranges had drifted the same way — vite `^7.3.1` against the repo's `^8.2.0`, typescript `^5.9.3` against `^6.0.3`, and seven more — and now read from the same table the temp-app generators use rather than from literals of their own.

The scaffold's CSS pipeline was already Tailwind 4 (`@tailwindcss/postcss`, `@import 'tailwindcss'`), and v4 reads a JS config only when a stylesheet points `@config` at one. The `tailwind.config.js` written beside it was therefore inert — an authoritative-looking `content` list nothing consumed — and is no longer written.
