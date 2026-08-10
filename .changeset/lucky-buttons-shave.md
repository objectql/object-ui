---
'@object-ui/cli': patch
---

Make the generated temp app pass the strict `tsconfig.json` the generator writes beside it, and gate it with a real `tsc`

Both app generators (`createTempApp`, `createTempAppWithRouting`) emit a `tsconfig.json` carrying `strict`, `noUnusedLocals` and `noUnusedParameters`, but nothing had ever run it — `dev`/`serve`/`build` go through Vite, which transpiles without type-checking — so the generated sources had drifted 17 errors past their own declared config. A user who copies the temp app out as a scaffold, or runs `tsc` in it, met all 17 at once.

Fixed at the templates: dropped five imports that were declared and never used (`Link` in `src/App.tsx`; `cn`, `Button`, `SidebarGroupContent`, `SidebarGroupLabel` in `src/Layout.tsx`), typed `DynamicIcon`'s and `AppLayout`'s props (which also types the `menu`/`children` map callbacks by inference, and makes `className` optional so the two call sites that omit it are legal), and added the `src/vite-env.d.ts` every Vite TS scaffold carries — without it the entry's `import './index.css'` has no declaration behind it, in both generators.

The Lucide lookup no longer needs `@ts-expect-error`: the namespace is narrowed to the component-by-name shape the layout actually uses. No `any` was added.

A real `tsc -p` over a generated app now runs in the package's tests, so the declared strictness is enforced rather than decorative.
