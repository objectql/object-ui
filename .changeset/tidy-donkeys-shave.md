---
---

Test-and-docs only: pin the console record page's DECLARED header-action `visible`
predicates against a **relation** field end to end (objectstack#8500), and document the
resulting contract on the `page:header` actions page.

No published behaviour changes. Both properties the card reports as broken were measured
correct on `main` and are now covered so they cannot regress silently:

- `os.user.id == record.manager` reaches ONE verdict whether the detail fetch delivered
  the lookup as its bare foreign key or as the expanded row — the seam between
  `toPredicateRecord` (objectui#3501) and the `RecordContext.objectSchema` the console
  page threads into it, which no component-level test can observe;
- a faulting spelling (`record.manager.id`) is fail-CLOSED **and** named in one console
  warning per predicate, per the standing 2026-08-06 ruling on objectui#4051.
