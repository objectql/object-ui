---
---

Dev-time only: move the `@objectstack/spec` resolution in `pnpm-lock.yaml` from
17.2.0 to 17.3.0. No published package changes — every manifest's declared range
(`^17.0.0` / `^17.1.0` / `^17.2.0`) already admitted 17.3.0, so no floor moved and
no package's dependency declaration differs by a byte. Empty frontmatter is the
deliberate "no release" declaration for a change that publishes nothing.
