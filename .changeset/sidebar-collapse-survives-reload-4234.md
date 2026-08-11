---
'@object-ui/components': patch
---

A collapsed sidebar now survives a reload — `SidebarProvider` reads the `sidebar_state` cookie it has always written

The cookie half of this feature only ever ran in one direction. `setOpen` wrote `sidebar_state` on every toggle with a 7-day max-age, and nothing ever read it back: `SidebarProvider` seeded its state from `defaultOpen` (default `true`), so a sidebar you collapsed came back expanded on the next load with the correct cookie sitting right there, unread. QA measured it at 255px and `data-state=expanded` at +2s, +4s and +8s after load, reproduced three times.

Upstream Shadcn closes this loop in a **server component** — it reads the cookie there and passes the value down as `defaultOpen`. A pure SPA like the console has no such step, which is why nothing downstream could paper over it: passing a cookie-derived `defaultOpen` from one shell would have fixed that shell and left every other consumer of the primitive broken. The read therefore happens client-side, in the provider, as a lazy `useState` initialiser rather than a mount effect — the state has to be right on the first render, since a post-mount correction would still flash an expanded sidebar at the user.

Precedence is now pinned, in this order: a controlled `open` prop, then the cookie, then `defaultOpen`, then `true`. The cookie overrides the *default*, never a controlled usage. With no cookie present the behaviour is exactly what it was before, which is what keeps explicit `defaultOpen={false}` call sites — the marketing demos in `apps/site` — rendering unchanged; those cases are controls in the new test file and are green on both sides of the change.

Only the two values the writer produces are honoured (`"true"` / `"false"`), matched on an exact cookie name; anything else, including an absent or malformed value, falls through to `defaultOpen` rather than inventing a preference the user never expressed. The reader is SSR-safe, which `apps/site` needs: those primitives are `"use client"`, and Next still renders them on the server for the initial HTML, where there is no `document`.

Because `packages/components/src/ui/**` is regenerated from the Shadcn registry, the primitive itself only gains two anchored one-liners. All of the parsing lives in `packages/components/src/lib/sidebar-cookie.ts`, which the sync never touches, and the two edits are declared in `scripts/shadcn-local-patches.mjs` so `pnpm shadcn:update` re-applies them instead of silently reverting the fix — the same mechanism already used for the translated `Sheet`/`Dialog` close labels.
