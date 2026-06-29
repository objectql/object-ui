---
"@object-ui/console": patch
---

ADR-0080: ship a `manifest-dump.html` build entry + `scripts/dump-public-manifest.mjs` that serialize the registry's public tier (`getPublicConfigs()`) to `sdui.manifest.json` — the artifact the framework `os build` JSX gate consumes for full component/prop validation. Generated in a real browser (the registry pulls browser-only deps); wired into `build-console.sh` framework-side.
