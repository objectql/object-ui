// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * REACHABILITY MEASUREMENT for objectui#8725 — a `{ group }` form section and
 * `SchemaForm`'s three unguarded `s.fields` reads.
 *
 * ⚠️ This file records a DEFECT that is still open. Its runtime pins assert what
 * this renderer does TODAY, which is to die. They are a measurement, not an
 * endorsement: whoever rules on the disposition (see "What is NOT decided here")
 * is expected to turn them into pins on the chosen behaviour, and their going
 * red is the intended signal that the ruling landed.
 *
 * ## Why the measurement was needed
 *
 * objectui#8725 was filed with reachability explicitly NOT measured, and named
 * that as its own gap: "a defect established only by reading is the thing this
 * queue has been wrong about before". The card guessed the inputs were "this
 * repo's own `*.form.ts` create/edit schemas, which do not author `group`",
 * which would have made the defect latent.
 *
 * That guess is FALSE, in a way that matters. This repository contains no
 * `*.form.ts` file at all. The `form` document `SchemaForm` renders arrives on
 * two channels, and the wider of the two is a SERVER document:
 *
 *   • `RichMetadataTypeEntry.form` (`useMetadata.ts`) is `Record<string,
 *     unknown>` — the `/meta/types` registry response, deserialised with no
 *     validation and no normalisation (`useMetadataTypes` casts the payload) —
 *     and `ResourceEditPage.tsx` hands it to this component as
 *     `form={... (entry?.form as any)}`. `EmbeddedItemEditor.tsx` does the same
 *     with `subEntry?.form as any`.
 *   • the spec-bundled forms (`getPageForm` / `getViewForm` / `getReportForm` /
 *     `getDashboardForm`), which read `pageForm` & co. straight out of
 *     `@objectstack/spec/ui` — an upstream, versioned document this repo does
 *     not author either. Measured against the installed 17.3.0, none of those
 *     four declares a `group` section today; that is a property of one spec
 *     release, not a barrier.
 *
 * So the REQUIRED `fields` on {@link FormSectionSpec} stands between a
 * TypeScript author and this renderer, and between nothing else. A section
 * carrying `group` and no `fields` — which `FormSectionSchema` ACCEPTS, measured
 * against the installed 17.3.0 — reaches the reads unimpeded.
 *
 * ## What was measured, and how the card's wording is one word off
 *
 * The card names three read sites and predicts `Cannot read properties of
 * undefined (reading 'map')`. That is the diagnostic of the SECOND and THIRD
 * sites. It is not what fires. `SchemaFormBody`'s own pre-flight loop is above
 * both of them in the same render, and it is a `for…of`, so the throw is a
 * TypeError naming iteration, not `.map` — see {@link readSiteThatFiresFirst}.
 * The distinction is load-bearing for whoever fixes this: guarding only the two
 * `.map` sites the card quotes leaves the crash exactly where it is.
 *
 * ## What is NOT decided here (objectui#8725's own framing)
 *
 * Neither half of the fix is in this file. Widening `FormSectionSpec.fields` to
 * optional ALONE removes the compile-time barrier above without deciding what
 * the reads do, which converts a `tsc` error into this same runtime death on a
 * second channel; and choosing what a group-referencing section renders is a
 * behaviour ruling on a renderer (`?? []` degrades it to an EMPTY section —
 * today's silent drop made non-throwing) or an import of
 * `resolveSectionGroupReferences` from `@object-ui/plugin-form`, which needs an
 * object definition this component is not handed. ⛔ And no assembly rule may be
 * re-implemented on the objectui side (objectui#7051, objectstack#13855).
 *
 * ## One thing the card could not know, measured here
 *
 * The trap the card names — "widening the type alone removes the compile-time
 * barrier" — is real but LOUD, not silent. Measured by widening
 * `FormSectionSpec.fields` to optional against this package's `type-check`:
 * `strictNullChecks` immediately reports `TS18048: 's.fields' is possibly
 * 'undefined'` at all three read sites (`SchemaForm.tsx` 786 / 1030 / 1147),
 * plus collateral at `form-spec.containers.test.tsx` PIN D (whose
 * `FormSectionSpec['fields'][number]` then needs a `NonNullable`) and four
 * sites in `mergeServerFields.test.ts`. So part 1 cannot ship without an author
 * confronting every read. What the compiler cannot do is stop them from typing
 * `?? []` to silence it — which is the behaviour ruling this card is holding
 * open, and the reason this file stops here.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SchemaForm } from './SchemaForm';
import type { FormSectionSpec, FormViewSpec } from './form-spec';
import type { RichMetadataTypeEntry } from './useMetadata';

afterEach(cleanup);

type Assert<T extends true> = T;

/**
 * Compile-time half. Erased at runtime, so vitest proves nothing about these;
 * `tsc -p packages/app-shell/tsconfig.test.json` (chained from this package's
 * `type-check` script) is what judges them.
 */
export function groupSectionReachabilityPins(): void {
  // ── PIN T1 — the BARRIER, as it stands today. `FormSectionSpec` re-declares
  // `fields` as REQUIRED while `FormSectionSchema` accepts `{ group }` with no
  // `fields` at all, so the spec-legal shape does not compile — inside a type
  // whose own header says it "describes what an AUTHOR WROTE, so it stays as
  // wide as the document".
  //
  // ⛔ This is a TWO-WAY pin and that is the point. `@ts-expect-error` is itself
  // an error (TS2578) the moment the line below it starts compiling, so nobody
  // can widen `fields` without this file going red and putting the runtime pins
  // below in front of them. objectui#8725's trap is precisely that the widening
  // reads like a one-character type fix while it REMOVES the only thing that
  // currently keeps a TypeScript author out of the crash measured below.
  //
  // Whoever lands the widening TOGETHER with a disposition for the read sites
  // should DELETE this pin — it has no value once the reads are safe.
  // @ts-expect-error objectui#8725 — `fields` is REQUIRED here; the spec-legal
  // `{ group }` section is refused by the type. Widening it alone is the trap.
  const specLegalSectionIsRefused: FormSectionSpec = { group: 'contact_info' };
  void specLegalSectionIsRefused;

  // Positive control for PIN T1: `group` itself IS a declared key of this type
  // (it is derived from the spec, and no `Omit` names it), so the refusal above
  // is about the MISSING `fields` and not about an unknown `group`. Without this
  // line, a type that had never heard of `group` would satisfy PIN T1 for the
  // wrong reason.
  const groupIsADeclaredKey: FormSectionSpec = { group: 'contact_info', fields: [] };
  void groupIsADeclaredKey;
  const groupIsOnTheSpecDerivedHalf: Assert<'group' extends keyof FormSectionSpec ? true : false> =
    true;
  void groupIsOnTheSpecDerivedHalf;

  // ── PIN T2 — the barrier guards ONE channel, and it is not the one that
  // reaches the renderer. The registry entry's `form` is an untyped server
  // document, so the crashing shape is assignable to it.
  //
  // OBSERVED RED, so this is a measurement and not a tautology: retyping
  // `RichMetadataTypeEntry.form` to `FormViewSpec` turns this line into
  // `TS2322: Type '{ label: string; group: string; }' is not assignable to type
  // 'FormSectionSpec'` — and, measured, into the ONLY error in the package.
  // That is the change which would put PIN T1's barrier on the path
  // `ResourceEditPage` actually renders (its `form={entry?.form as any}` cast
  // would have to go with it). Until then the `as any` at that call site is not
  // a lint smell, it is the whole reachability result.
  const serverRegistryFormAdmitsIt: NonNullable<RichMetadataTypeEntry['form']> = {
    type: 'simple',
    sections: [{ label: 'Contact', group: 'contact_info' }],
  };
  void serverRegistryFormAdmitsIt;
}

const schema = {
  type: 'object',
  properties: {
    a: { type: 'string', title: 'Field A' },
    b: { type: 'string', title: 'Field B' },
  },
};

/**
 * The crashing document, spelled the way it ARRIVES: a plain deserialised
 * object, not a `FormViewSpec` literal. `as never` at the prop is this file's
 * stand-in for `ResourceEditPage`'s `as any` — the cast is part of the
 * measurement, not a convenience.
 */
const serverFormWithGroupSection = {
  type: 'simple',
  sections: [{ label: 'Contact', group: 'contact_info' }],
};

function renderCatching(form: unknown): { error: Error | undefined; html: string } {
  let error: Error | undefined;
  let html = '';
  try {
    const { container } = render(
      <SchemaForm schema={schema} form={form as never} value={{ a: '' }} onChange={() => {}} />,
    );
    html = container.innerHTML;
  } catch (err) {
    error = err as Error;
  }
  return { error, html };
}

describe('objectui#8725 — a `{ group }` section reaching SchemaForm', () => {
  // ── PIN R1 — CONTROL, and the non-regression leg. A section that authors
  // `fields` renders them. Everything below is a claim about the ABSENCE of
  // `fields`; without this line a renderer that drew nothing at all would
  // satisfy the whole file. This is the pin that reddens under the caricature
  // "every section resolves to no fields".
  it('CONTROL: a section that authors `fields` still renders them', () => {
    const form: FormViewSpec = {
      type: 'simple',
      sections: [{ label: 'Basics', fields: [{ field: 'a' }] }],
    };
    render(<SchemaForm schema={schema} form={form} value={{ a: '' }} onChange={() => {}} />);
    expect(screen.getByText('Field A')).toBeInTheDocument();
    expect(screen.getByText('Basics')).toBeInTheDocument();
  });

  // ── PIN R2 — REACHED, and it throws OUT OF THE COMPONENT BODY. Not "renders
  // an empty section", not "renders a bordered card with a heading": `render()`
  // itself throws, so there is no partial tree to inspect and no per-section
  // boundary could have contained it. This is the shape that blanked
  // `SimpleObjectForm` before PR #8644.
  it('MEASURED TODAY (defect): the render throws instead of degrading', () => {
    const { error, html } = renderCatching(serverFormWithGroupSection);
    expect(error).toBeInstanceOf(TypeError);
    // The envelope, not just "it threw": the message is one of the two
    // diagnostics the unguarded `s.fields` reads produce, which is what
    // identifies this as that family and not some unrelated failure in the
    // render path. WHICH of the two fires is PIN R3's business, deliberately —
    // so a half-fix moves R3 and R5 without disturbing this line.
    expect(error?.message).toMatch(/\bfields\b|reading ['"]map['"]/);
    // Nothing rendered. The card's parent measurement (objectui#8641) found a
    // VISIBLE empty bordered card for its defect; this one leaves no DOM at all.
    expect(html).toBe('');
  });

  // ── PIN R3 — WHICH read site fires, and the correction to the card's wording.
  //
  // objectui#8725 quotes `Cannot read properties of undefined (reading 'map')`
  // and names `SchemaForm.tsx:786` / `:1030` / `:1147`. `:786` is
  // `for (const f of s.fields)` inside `SchemaFormBody`'s pre-flight
  // "does the layout name any field this schema has" loop, and it runs BEFORE
  // `SectionedSchemaForm` is even constructed — so the `.map` diagnostic the
  // card predicts is never the one a user sees.
  //
  // ⚠️ The exact V8 text observed here is `s.fields is not iterable`; the
  // assertions below are written so that the DISCRIMINATION (iteration site vs
  // `.map` site) does not rest on engine-specific wording. Guarding only the two
  // `.map` sites turns this pin red while PIN R2 stays green, which is exactly
  // the half-fix this pin exists to catch.
  it('MEASURED TODAY (defect): the FIRST unguarded read is the `for…of`, not a `.map`', () => {
    const { error } = renderCatching(serverFormWithGroupSection);
    expect(error?.message).not.toMatch(/reading ['"]map['"]/);
    expect(error?.message).toMatch(/not iterable/);
  });

  // ── PIN R4 — one bad section takes the WHOLE form with it, including the
  // sections that are perfectly well-formed. This is why the disposition is a
  // ruling and not a nicety: the blast radius is the document, not the section.
  it('MEASURED TODAY (defect): a well-formed sibling section is destroyed with it', () => {
    const mixed = {
      type: 'simple',
      sections: [
        { label: 'Basics', fields: ['a'] },
        { label: 'Contact', group: 'contact_info' },
      ],
    };
    const { error, html } = renderCatching(mixed);
    expect(error).toBeInstanceOf(TypeError);
    expect(html).toBe('');
  });

  // ── PIN R5 — the tabbed arm dies the same way, at the same site. `:1147` is
  // inside the `isTabbed` branch, so a reader could reasonably expect the tabbed
  // form to fail differently; it does not, because `:786` is upstream of both
  // arms. Recorded so the fix is not scoped to one arm.
  it('MEASURED TODAY (defect): the tabbed arm dies at the same upstream read', () => {
    const tabbed = {
      type: 'tabbed',
      sections: [
        { label: 'Basics', fields: ['a'] },
        { label: 'Contact', group: 'contact_info' },
      ],
    };
    const { error } = renderCatching(tabbed);
    expect(error).toBeInstanceOf(TypeError);
    expect(error?.message).toMatch(/not iterable/);
  });
});

/**
 * Named export so the compile-time block above is not dead code to the linter,
 * mirroring `form-spec.containers.test.tsx`'s `formContainerContractPins`.
 */
export const readSiteThatFiresFirst = 'SchemaForm.tsx SchemaFormBody — for (const f of s.fields)';
