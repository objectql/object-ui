---
---

Test-infrastructure only; no published behaviour changes. The `unit` Vitest project runs `isolate: false`, so its worker shares one `globalThis`, and five test files left a double on a shared global instead of handing it back — which is why `scripts/__tests__/network-escape-ledger.test.ts` reported a `vi.fn()` where the network-escape guard's `fetch` wrapper belonged. Those files now stub and unstub, and a new per-file guard reds the file that leaks a shared global instead of letting the failure surface in a later, innocent one.
