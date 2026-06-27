---
"@object-ui/app-shell": patch
---

fix(home): the workspace empty-state title hardcoded "Welcome to ObjectUI" — a stale brand a first-time user sees on their empty `/home`. Read the product name from the runtime-config branding (`getRuntimeConfig().branding.productName`, server-pushed, fallback "ObjectOS") like LoadingScreen does, so it shows the deployment's real product (e.g. "Welcome to ObjectOS Cloud").
