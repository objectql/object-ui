---
'@object-ui/create-plugin': patch
---

Type the `test:` block in the scaffolded `vite.config.ts`.

The emitted config passed a `test:` block to a `defineConfig` imported from
`vite`, whose `UserConfig` declares no `test` key — TS2769 in every editor a
freshly scaffolded plugin is opened in, on day one, for every plugin this
generator writes. The config now carries `/// <reference types="vitest/config" />`,
which pulls in vitest's `declare module "vite"` augmentation and supplies the
missing declaration at zero run-time cost. The `test:` block itself is unchanged
and stays: it is the only thing giving the scaffolded example test a DOM.
