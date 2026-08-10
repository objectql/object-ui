import React, { useId } from 'react';
import { Input, Label, EmptyValue } from '@object-ui/components';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { toHostGroupProps } from './toHostGroupProps';

/**
 * Address data structure — the part names of `@objectstack/spec`'s
 * `AddressSchema`, which is what the platform stores and what
 * `/api/v1/data/**` serves back.
 *
 * The postal code is spelled `postalCode` (objectstack#5143). This widget used
 * to read and write `zipCode`, a key that appears nowhere in the spec, so the
 * stored postal code never reached the input — and whatever the user then typed
 * into that apparently-empty box was written under a key `AddressValueSchema`
 * strips: lost outright on a new record, and on an existing one silently
 * discarded while the stale stored value survived. (A postal code nobody
 * touched did survive an unrelated edit, because the write spread the whole
 * stored object through; the issue's account of that half is corrected in
 * `AddressField.postalCode.test.tsx`.) One name, on both sides: the contract's.
 */
export interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * The shape written by builds up to and including 17.0.0-rc.1, whose postal
 * code landed under `zipCode` (objectstack#5143). Read-time compatibility ONLY,
 * and deliberately not part of {@link AddressValue}: authoring code must not be
 * able to spell `zipCode`, and nothing here ever writes it back — the first
 * edit of any part normalizes the record onto `postalCode` (see
 * `handleFieldChange`). This is not a producer alias to be honoured forever;
 * it exists to carry data THIS widget mis-wrote, and can go once no such data
 * remains.
 */
type LegacyAddressValue = AddressValue & { zipCode?: string };

/** Postal code of a stored address, preferring the canonical key. */
function readPostalCode(addr: AddressValue): string | undefined {
  return addr.postalCode ?? (addr as LegacyAddressValue).zipCode;
}

/**
 * Address field widget - provides a structured address input
 * Supports street, city, state, postal code, and country
 */
export function AddressField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<AddressValue>) {
  const address = value || {};
  // DOM pass-through (objectui#3318): the whitelist spread goes onto the FIRST
  // sub-input (street) — one carrier for the form renderer's aria-describedby;
  // the composite's validation state goes onto EVERY focusable sub-input via
  // `aria-invalid={!!error}` (a form-level failure means the whole address is
  // missing/invalid, and whichever sub-input the user reaches must announce it).
  //
  // Two keys are held back from that spread and land on the group CONTAINER
  // instead (objectui#3961), because they address the field as a WHOLE:
  //
  //  - `id` — the host's control id. It never reached the DOM at all: it was
  //    spread here and then overwritten one line later by `id={subId('street')}`
  //    (objectui#3343), which is why the form's "Shipping Address" label pointed
  //    at an id no element carried. The sub-input ids stay exactly as they are;
  //    only the host id moves out to the element it was always meant to name.
  //  - `aria-labelledby` — the host's label, associated by IDREF. On the street
  //    input it would be actively wrong: `aria-labelledby` OVERRIDES a control's
  //    `<label for>`, so the first sub-input would be announced as "Shipping
  //    Address" and its own "Street Address" label would vanish.
  //
  // Everything else (`aria-describedby`, `name`, focus handlers …) deliberately
  // stays on the first sub-input: a description or error must be announced when
  // focus lands on something focusable, and a container is not.
  const {
    id: _hostId,
    'aria-labelledby': _hostLabelledBy,
    ...domProps
  } = toDomProps(props);
  // The pair held back above, in the one spelling every group-labelled widget
  // uses for it — and computed HERE, before the readonly early return below,
  // because that return used to drop both keys on the floor: a published label
  // id with no consumer in the document (objectui#3990). See `toHostGroupProps`.
  const hostGroupProps = toHostGroupProps(props);
  // Sub-input ids (objectui#3343): `useId()` prefix + sub-field name — the
  // `groupId` paradigm of RadioField / CheckboxesField. Hardcoded literals
  // ("street", "city", …) collide as soon as a form renders two address
  // fields, and every label's htmlFor then resolves to the FIRST match.
  const groupId = useId();
  const subId = (name: keyof AddressValue) => `${groupId}-${name}`;

  // Read through the legacy key, write only the canonical one (objectstack#5143).
  const postalCode = readPostalCode(address);

  const handleFieldChange = (fieldName: keyof AddressValue, fieldValue: string) => {
    // Normalize while we are here: the object we write back never carries
    // `zipCode`, and a legacy postal code is carried forward under
    // `postalCode`. Without the carry, editing an unrelated part of a
    // legacy-shaped address would write the postal code straight back out of
    // the record — the very data loss this fixes, one build later.
    const canonical: LegacyAddressValue = { ...address };
    delete canonical.zipCode;
    onChange({
      ...canonical,
      ...(postalCode ? { postalCode } : null),
      [fieldName]: fieldValue,
    });
  };

  const formatAddress = (addr: AddressValue): string => {
    const parts = [
      addr.street,
      addr.city,
      [addr.state, readPostalCode(addr)].filter(Boolean).join(' '),
      addr.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (readonly) {
    // Readonly the composite collapses to ONE formatted line — no sub-inputs and
    // no sub-labels — so that line is the surface the host label names, and
    // `EmptyValue` is the same surface with nothing in it (objectui#3990). The
    // placeholder's own `aria-label` ("No value") is outranked by
    // `aria-labelledby` per accname, and on its `generic` role an author name was
    // never exposed anyway.
    const formatted = formatAddress(address);
    return formatted ? (
      <span {...hostGroupProps} className="text-sm">{formatted}</span>
    ) : (
      <EmptyValue {...hostGroupProps} />
    );
  }

  return (
    // `role="group"` only when a host actually named this container
    // (objectui#3961): an unnamed group adds nothing for assistive tech, and
    // standalone rendering — the inline grid editor, a bare SDUI node — must stay
    // byte-identical to what it was before. That condition now lives in
    // `toHostGroupProps` so this container and the readonly line above cannot
    // answer differently (objectui#3990).
    <div className="space-y-3" {...hostGroupProps}>
      <div>
        <Label htmlFor={subId('street')} className="text-xs">Street Address</Label>
        <Input
          {...domProps}
          id={subId('street')}
          type="text"
          value={address.street || ''}
          onChange={(e) => handleFieldChange('street', e.target.value)}
          placeholder="123 Main St"
          disabled={readonly || props.disabled}
          className={props.className}
          aria-invalid={!!error}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={subId('city')} className="text-xs">City</Label>
          <Input
            id={subId('city')}
            type="text"
            value={address.city || ''}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            placeholder="San Francisco"
            disabled={readonly || props.disabled}
            aria-invalid={!!error}
          />
        </div>
        
        <div>
          <Label htmlFor={subId('state')} className="text-xs">State / Province</Label>
          <Input
            id={subId('state')}
            type="text"
            value={address.state || ''}
            onChange={(e) => handleFieldChange('state', e.target.value)}
            placeholder="CA"
            disabled={readonly || props.disabled}
            aria-invalid={!!error}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={subId('postalCode')} className="text-xs">ZIP / Postal Code</Label>
          <Input
            id={subId('postalCode')}
            type="text"
            value={postalCode || ''}
            onChange={(e) => handleFieldChange('postalCode', e.target.value)}
            placeholder="94102"
            disabled={readonly || props.disabled}
            aria-invalid={!!error}
          />
        </div>
        
        <div>
          <Label htmlFor={subId('country')} className="text-xs">Country</Label>
          <Input
            id={subId('country')}
            type="text"
            value={address.country || ''}
            onChange={(e) => handleFieldChange('country', e.target.value)}
            placeholder="United States"
            disabled={readonly || props.disabled}
            aria-invalid={!!error}
          />
        </div>
      </div>
    </div>
  );
}
