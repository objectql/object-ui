# @object-ui/console

## 3.3.1

### Patch Changes

- db7a418: fix(console): respect Vite `BASE_URL` when redirecting after a workspace
  switch. The post-switch redirect previously hardcoded `/console/home`,
  which broke deployments served from a different base path (e.g. Vercel,
  where the console is mounted at `/`). It now derives the target from
  `import.meta.env.BASE_URL`, so it works both behind `HonoServerPlugin`
  (`/console/home`) and on standalone deployments (`/home`).

## 3.3.0

## 3.2.0

### Minor Changes

- 91a9103: upgrade objectstack ai service

## 3.1.5

## 3.1.4

### Patch Changes

- 7129017: fix

## 3.1.3

## 3.1.2

## 3.1.1

## 3.0.3

### Patch Changes

- e1267d2: fix: re-attach listViews to object metadata stripped by defineStack() Zod parse

## 3.0.2

### Patch Changes

- f1c2fc1: fix build

## 3.0.1

## 3.0.0

### Major Changes

- Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer
