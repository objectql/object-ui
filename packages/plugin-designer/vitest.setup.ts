/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '@testing-library/jest-dom';

// Polyfill ResizeObserver for Radix UI (Shadcn) components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill HTMLDialogElement methods for happy-dom/jsdom
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function () {
    this.removeAttribute('open');
  };
}
