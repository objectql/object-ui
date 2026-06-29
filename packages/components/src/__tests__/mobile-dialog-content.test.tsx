/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * MobileDialogContent guards against a portalled dropdown closing the whole
 * dialog. Radix Select / Popover render their flyout into a portal at
 * `document.body` (outside the dialog DOM), so clicking empty space inside an
 * open dropdown reads as an "interact outside" and used to dismiss the dialog.
 * `isInsidePopperLayer` is the predicate that suppresses that case while
 * leaving a genuine backdrop click (which still closes the dialog) untouched.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { isInsidePopperLayer } from '../custom/mobile-dialog-content';

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isInsidePopperLayer', () => {
  it("treats a click inside a Radix popper wrapper as the dialog's own dropdown", () => {
    const host = mount(
      '<div data-radix-popper-content-wrapper><div role="listbox"><div id="opt">option</div></div></div>',
    );
    expect(isInsidePopperLayer(host.querySelector('#opt'))).toBe(true);
  });

  it('matches the select content / viewport variants too', () => {
    const host = mount(
      '<div data-radix-select-content><div data-radix-select-viewport><span id="item">x</span></div></div>',
    );
    expect(isInsidePopperLayer(host.querySelector('#item'))).toBe(true);
    expect(isInsidePopperLayer(host.querySelector('[data-radix-select-content]'))).toBe(true);
  });

  it('does NOT match a genuine backdrop / outside-the-dropdown target', () => {
    const host = mount('<div id="overlay" data-radix-dialog-overlay></div>');
    expect(isInsidePopperLayer(host.querySelector('#overlay'))).toBe(false);
  });

  it('is null/undefined safe', () => {
    expect(isInsidePopperLayer(null)).toBe(false);
    expect(isInsidePopperLayer(undefined)).toBe(false);
  });
});
