import React from 'react';
import { EmptyValue } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import { formatDate } from '@object-ui/core';
import { FieldWidgetComponentProps } from './types.js';

/**
 * FormulaField - Read-only computed field
 * Values are computed on the backend and cannot be edited
 */
export function FormulaField({ value, field, ...props }: FieldWidgetComponentProps<any>) {
  // Before the empty-value early return — the hook count must not change when
  // a value flips between null and set. A `date` return type used to format
  // through the MACHINE's locale (objectui#4468).
  const locale = useDisplayLocale();
  const formulaField = field as any;
  const returnType = formulaField?.return_type || 'text';

  if (value == null) {
    return <EmptyValue className={props.className} />;
  }

  let displayValue: string;
  if (returnType === 'number' || returnType === 'currency') {
    displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);
  } else if (returnType === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (returnType === 'date') {
    // `formatDate`'s DEFAULT style — the one home for the `date` display
    // convention (objectui#8194, following the maintainer's ruling A on
    // objectui#7620). This branch used to call `toLocaleDateString(locale)`
    // with NO options bag, i.e. `Intl`'s numeric default (`7/4/2026`), so a
    // formula returning a date rendered a face the shared function never
    // produces — while the `date` field beside it showed `Jul 4`. Two faces
    // for one value, kept in step by nothing.
    //
    // An unparseable computed value reads `—` (the shared function's empty
    // face) instead of the literal `Invalid Date`; that is a consequence of
    // using the one home, not a second convention.
    //
    // It now reads that dash through the shared AFFORDANCE rather than
    // through the plain span below (objectui#8809). The glyph is identical --
    // `EmptyValue`'s own default glyph IS this em-dash -- so what changes is
    // the CARRIER: the dash gains `data-slot` of `empty-value` and an
    // accessible name, where before a screen reader got naked punctuation.
    // Same defect and same repair as `DateField`'s readonly face, which is
    // why the two are fixed together: objectui#8194 converged these sites'
    // GLYPH, and repairing one carrier alone would open a fresh split in the
    // carrier right where that card closed one.
    //
    // objectui#8194's landed pin for this site reads `container.textContent`
    // and stays green, because the text is still a dash. Co-extensive with
    // the dash it replaces, never wider: `new Date(value)` reproduces
    // `formatDate`'s own parse step, and the `value == null` guard above
    // already owns the EMPTY half of what the shared function dashes.
    const date = new Date(value);
    if (isNaN(date.getTime())) return <EmptyValue className={props.className} />;
    displayValue = formatDate(value, undefined, { locale });
  } else {
    displayValue = String(value);
  }

  return (
    <span className={`text-sm font-mono text-gray-700 ${props.className || ''}`}>
      {displayValue}
    </span>
  );
}
