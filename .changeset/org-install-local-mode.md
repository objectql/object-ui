---
"@object-ui/app-shell": patch
---

"Your organization" Install routes by deployment shape: install-local runtimes (runtime-config `features.installLocal`) install via `/marketplace/install-local` into their OWN kernel (the bound oscc_ credential fetches the org manifest — ADR-0008); cloud-managed environments keep the control-plane `/cloud-connection/install` path. Previously the org Install button always called the control-plane path, which 401s on self-hosted runtimes.
