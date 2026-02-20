/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Mobile Accessibility Audit — axe-core checks at mobile viewport widths.
 *
 * Verifies that common UI patterns (buttons, forms, navigation, dialogs,
 * tables) remain WCAG 2.1 AA compliant when rendered in a narrow container
 * that simulates a mobile viewport. Part of P3 Mobile Testing & QA.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import React from 'react';

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container);
  const violations = (results as any).violations || [];
  if (violations.length > 0) {
    const messages = violations.map(
      (v: any) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))`,
    );
    throw new Error(
      `Expected no accessibility violations, but found ${violations.length}:\n${messages.join('\n')}`,
    );
  }
}

const MOBILE_WIDTH = 375;

describe('Mobile Accessibility Audit', () => {
  it('should have no axe violations for Button at mobile viewport', async () => {
    const { container } = render(
      <div style={{ width: `${MOBILE_WIDTH}px` }}>
        <button type="button">Click me</button>
      </div>,
    );
    await expectNoViolations(container);
  });

  it('should have no axe violations for form inputs at mobile viewport', async () => {
    const { container } = render(
      <div style={{ width: `${MOBILE_WIDTH}px` }}>
        <form>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" />
          <button type="submit">Submit</button>
        </form>
      </div>,
    );
    await expectNoViolations(container);
  });

  it('should have no axe violations for navigation at mobile viewport', async () => {
    const { container } = render(
      <div style={{ width: `${MOBILE_WIDTH}px` }}>
        <nav aria-label="Main navigation">
          <ul>
            <li>
              <a href="/">Home</a>
            </li>
            <li>
              <a href="/about">About</a>
            </li>
          </ul>
        </nav>
      </div>,
    );
    await expectNoViolations(container);
  });

  it('should have no axe violations for dialog at mobile viewport', async () => {
    const { container } = render(
      <div style={{ width: `${MOBILE_WIDTH}px` }}>
        <div role="dialog" aria-label="Confirmation" aria-modal="true">
          <h2>Confirm Action</h2>
          <p>Are you sure?</p>
          <button type="button">Yes</button>
          <button type="button">No</button>
        </div>
      </div>,
    );
    await expectNoViolations(container);
  });

  it('should have no axe violations for data table at mobile viewport', async () => {
    const { container } = render(
      <div style={{ width: `${MOBILE_WIDTH}px`, overflow: 'auto' }}>
        <table>
          <caption>Sample data</caption>
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Item 1</td>
              <td>100</td>
            </tr>
            <tr>
              <td>Item 2</td>
              <td>200</td>
            </tr>
          </tbody>
        </table>
      </div>,
    );
    await expectNoViolations(container);
  });
});
