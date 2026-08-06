---
'@object-ui/components': patch
---

`PageRenderer` no longer renders its own `<h1>` when the page authors a titled `page:header`, so a page has exactly one level-1 heading. Every non-record page used to render the page `title`/`label` as an `h1` *and* let the `page:header` block render a second one — on the showcase master-detail page both said "New Project + Tasks", producing a broken document outline, a page title a screen reader announces twice, and the same string printed twice on screen. Record pages already delegated the whole title block to `page:header`; that rule now holds for `app` / `home` / `utility` pages too, and it is what the live e2e was reporting as a Playwright strict-mode violation (`getByRole('heading', { name })` resolving to 2 elements, objectui#3434).

Delegation is deliberately conservative: only a `page:header` whose title renders literal text takes the heading over. A header with no title — or one whose title interpolates to nothing (e.g. `title: '{name}'` with no record in scope) — renders no heading of its own, so the page keeps its implicit `h1` rather than ending up with none. The page-level `description` is unaffected; it is the page's own prose, not a duplicate of the header `subtitle`.

Author-visible effect: on a page carrying both a `label` and a titled `page:header`, only the header's title is shown (e.g. app-crm's welcome page shows "Welcome to the CRM", not also "CRM Welcome"). Pages without a `page:header` are unchanged.
