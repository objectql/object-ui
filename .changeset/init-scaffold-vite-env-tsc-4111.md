---
'@object-ui/cli': patch
---

Fix `objectui init`'s scaffold failing its own `npm run build`, and put the third generator under the real `tsc` gate

The scaffold `objectui init` writes declares `"build": "tsc && vite build"`, so `tsc` runs on the way to a production build — and its `src/main.tsx` did `import './index.css'` with no ambient declaration behind it. Any user who followed the generated README (`objectui init`, then `npm run build`) got `TS2882: Cannot find module or type declarations for side-effect import of './index.css'` in a file the tool had just written for them, before Vite was ever reached.

Fixed the same way objectui#3853 fixed the two temp-app generators: the scaffold now writes `src/vite-env.d.ts` (`/// <reference types="vite/client" />`), where the `declare module '*.css'` declarations live. `vite` was already in the scaffold's `devDependencies`, so nothing new is declared.

Measured rather than assumed: this scaffold had that one error and none of the other four classes objectui#3853 found in the temp apps — those live in a `src/Layout.tsx` this scaffold does not have. The `tsc` gate in `app-generator.test.ts` now covers the init scaffold too, so the strictness its own `tsconfig.json` declares is enforced instead of decorative.
