---
"@object-ui/components": patch
---

fix(form): stop `form.reset()` from wiping user input on re-render

The form renderer reset react-hook-form whenever the `defaultValues` **object
identity** changed:

```ts
useEffect(() => { form.reset(defaultValues); }, [defaultValues]);
```

Callers commonly pass a freshly-built `defaultValues` object every render, so an
unrelated parent re-render reset the form and discarded whatever the user had
typed. This broke master-detail "Create": a re-render between the submit click
and the (deferred) `requestSubmit` blanked the form, so RHF then failed
required-field validation on the now-empty fields and nothing was submitted —
the "click Create, nothing happens" report.

The effect now resets only when `defaultValues` actually **changes by value**
(JSON-compared), so a genuine change (e.g. an edit-mode record finishing
loading) still resets while identity churn is ignored.
