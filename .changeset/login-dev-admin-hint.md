---
"@object-ui/console": patch
"@object-ui/i18n": patch
---

Login page surfaces the dev-seeded admin credentials. The framework runtime seeds `admin@objectos.ai` on an empty development database, but nothing on the login page said so — new users clicked "Sign up" and landed in an empty non-admin workspace (15.1 third-party eval). When `GET /api/v1/auth/config` reports `devSeedAdmin` (dev-only; the server omits the field in production and once the default password is changed), the page renders a dismissible amber banner with the credentials. Dismissal persists per browser via localStorage.
