import { describe, it, expect, beforeEach } from 'vitest';
import {
  enableCapability,
  disableCapability,
  isCapabilityEnabled,
  CAP_REACT_PAGES,
} from '../capabilities.js';

describe('runtime capabilities', () => {
  beforeEach(() => disableCapability(CAP_REACT_PAGES));

  it('is default-closed', () => {
    expect(isCapabilityEnabled(CAP_REACT_PAGES)).toBe(false);
    expect(isCapabilityEnabled('anything-else')).toBe(false);
  });

  it('enables and disables', () => {
    enableCapability(CAP_REACT_PAGES);
    expect(isCapabilityEnabled(CAP_REACT_PAGES)).toBe(true);
    disableCapability(CAP_REACT_PAGES);
    expect(isCapabilityEnabled(CAP_REACT_PAGES)).toBe(false);
  });

  it('exposes the react-pages capability constant', () => {
    expect(CAP_REACT_PAGES).toBe('react-pages');
  });
});
