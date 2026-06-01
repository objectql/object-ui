import { describe, it, expect } from 'vitest';
import { coerceToSafeValue } from './index';

describe('coerceToSafeValue — reference / lookup values', () => {
  it('extracts a label from a JSON-string reference (unresolved external-id ref)', () => {
    // Regression: a master_detail/lookup value can arrive as a JSON-encoded
    // string; it must render a label, not raw '{"externalId":"..."}'.
    expect(coerceToSafeValue('{"externalId":"Website Relaunch"}')).toBe('Website Relaunch');
  });

  it('extracts a label from a reference object, name > label > externalId > id', () => {
    expect(coerceToSafeValue({ externalId: 'X' })).toBe('X');
    expect(coerceToSafeValue({ name: 'N', externalId: 'X' })).toBe('N');
    expect(coerceToSafeValue({ label: 'L', externalId: 'X' })).toBe('L');
    expect(coerceToSafeValue({ id: 'id1' })).toBe('id1');
  });

  it('handles a JSON-string array of references', () => {
    expect(coerceToSafeValue('[{"name":"A"},{"externalId":"B"}]')).toBe('A, B');
  });

  it('leaves plain strings and non-JSON-looking strings untouched', () => {
    expect(coerceToSafeValue('Website Relaunch')).toBe('Website Relaunch');
    expect(coerceToSafeValue('{not valid json')).toBe('{not valid json');
    expect(coerceToSafeValue('hello')).toBe('hello');
  });

  it('passes through primitives and null/undefined', () => {
    expect(coerceToSafeValue(42)).toBe(42);
    expect(coerceToSafeValue(true)).toBe(true);
    expect(coerceToSafeValue(null)).toBe(null);
    expect(coerceToSafeValue(undefined)).toBe(undefined);
  });
});
