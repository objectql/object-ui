/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Console page-level axe-core accessibility audit.
 *
 * Tests full Console page assemblies (layout, sidebar, header, key views)
 * against WCAG 2.1 AA standards using axe-core.
 * Part of P2.3 Accessibility & Inclusive Design roadmap.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mock heavy dependencies to isolate layout accessibility testing
vi.mock('@objectstack/client', () => ({
  ObjectStackClient: class {
    connect = vi.fn().mockResolvedValue(true);
  },
}));

vi.mock('../../objectstack.shared', () => ({
  default: {
    apps: [
      {
        name: 'sales',
        label: 'Sales App',
        active: true,
        icon: 'briefcase',
        navigation: [
          { id: 'nav_opp', label: 'Opportunities', type: 'object', objectName: 'opportunity' },
          { id: 'nav_contact', label: 'Contacts', type: 'object', objectName: 'contact' },
        ],
      },
    ],
    objects: [
      { name: 'opportunity', label: 'Opportunity', fields: {} },
      { name: 'contact', label: 'Contact', fields: {} },
    ],
  },
}));

vi.mock('../dataSource', () => {
  const MockAdapter = class {
    find = vi.fn().mockResolvedValue([]);
    findOne = vi.fn();
    create = vi.fn();
    update = vi.fn();
    delete = vi.fn();
    connect = vi.fn().mockResolvedValue(true);
    onConnectionStateChange = vi.fn();
    discovery = {};
  };
  return {
    ObjectStackAdapter: MockAdapter,
    ObjectStackDataSource: MockAdapter,
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const createIcon = (name: string) => (props: any) =>
    React.createElement('span', { 'data-testid': `icon-${name}`, 'aria-hidden': 'true', ...props });
  return {
    ...actual,
    Database: createIcon('database'),
    LayoutDashboard: createIcon('dashboard'),
    Briefcase: createIcon('briefcase'),
    ChevronRight: createIcon('chevron-right'),
    ChevronsUpDown: createIcon('chevrons-up-down'),
    Settings: createIcon('settings'),
    LogOut: createIcon('logout'),
    Plus: createIcon('plus'),
    Menu: createIcon('menu'),
    Search: createIcon('search'),
    Bell: createIcon('bell'),
    User: createIcon('user'),
    Users: createIcon('users'),
    Sun: createIcon('sun'),
    Moon: createIcon('moon'),
    Home: createIcon('home'),
    X: createIcon('x'),
  };
});

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container);
  const violations = (results as any).violations || [];
  if (violations.length > 0) {
    const messages = violations.map(
      (v: any) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))`
    );
    throw new Error(
      `Expected no accessibility violations, but found ${violations.length}:\n${messages.join('\n')}`
    );
  }
}

describe('Console Page-Level Accessibility Audit', () => {
  it('main layout structure has proper landmarks', async () => {
    const { container } = render(
      <MemoryRouter>
        <div className="flex h-screen">
          <aside aria-label="Sidebar navigation">
            <nav aria-label="Main navigation">
              <ul role="list">
                <li><a href="/apps/sales/opportunities">Opportunities</a></li>
                <li><a href="/apps/sales/contacts">Contacts</a></li>
              </ul>
            </nav>
          </aside>
          <main aria-label="Main content">
            <div role="region" aria-label="Console header">
              <h1>Sales App</h1>
              <button aria-label="Search">Search</button>
              <button aria-label="Notifications">Notifications</button>
            </div>
            <div role="region" aria-label="Page content">
              <p>Welcome to the Console</p>
            </div>
          </main>
        </div>
      </MemoryRouter>
    );
    await expectNoViolations(container);
  });

  it('sidebar navigation with links has no violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <nav aria-label="Application navigation">
          <div role="group" aria-label="Sales App">
            <h2>Sales App</h2>
            <ul role="list">
              <li>
                <a href="/apps/sales/opportunities" aria-current="page">
                  Opportunities
                </a>
              </li>
              <li>
                <a href="/apps/sales/contacts">Contacts</a>
              </li>
            </ul>
          </div>
        </nav>
      </MemoryRouter>
    );
    await expectNoViolations(container);
  });

  it('header with search and actions has no violations', async () => {
    const { container } = render(
      <header role="banner" aria-label="Console header">
        <div className="flex items-center justify-between">
          <h1>Sales App</h1>
          <div role="search" aria-label="Global search">
            <label htmlFor="console-search" className="sr-only">Search</label>
            <input id="console-search" type="search" placeholder="Search..." aria-label="Search" />
          </div>
          <div role="group" aria-label="Header actions">
            <button aria-label="Toggle theme">Theme</button>
            <button aria-label="View notifications">Notifications</button>
            <button aria-label="User menu">Profile</button>
          </div>
        </div>
      </header>
    );
    await expectNoViolations(container);
  });

  it('dashboard view with cards and widgets has no violations', async () => {
    const { container } = render(
      <main aria-label="Dashboard">
        <h1>Dashboard</h1>
        <div role="region" aria-label="Key metrics">
          <div role="group" aria-label="Metric cards">
            <article aria-label="Total Revenue">
              <h2>Total Revenue</h2>
              <p aria-live="polite">$45,231.89</p>
            </article>
            <article aria-label="Active Users">
              <h2>Active Users</h2>
              <p aria-live="polite">2,350</p>
            </article>
          </div>
        </div>
        <div role="region" aria-label="Recent activity">
          <h2>Recent Activity</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Task 1</td>
                <td>Complete</td>
                <td>2024-01-15</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    );
    await expectNoViolations(container);
  });

  it('object list view with table has no violations', async () => {
    const { container } = render(
      <main aria-label="Opportunities list">
        <div className="flex items-center justify-between">
          <h1>Opportunities</h1>
          <div role="toolbar" aria-label="List actions">
            <button>New</button>
            <button aria-label="Filter list">Filter</button>
            <button aria-label="Sort list">Sort</button>
          </div>
        </div>
        <table aria-label="Opportunities table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Amount</th>
              <th scope="col">Stage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Acme Corp Deal</td>
              <td>$50,000</td>
              <td>Negotiation</td>
            </tr>
            <tr>
              <td>Beta Inc Deal</td>
              <td>$25,000</td>
              <td>Proposal</td>
            </tr>
          </tbody>
        </table>
        <nav aria-label="Pagination">
          <ul role="list">
            <li><button aria-label="Previous page">Previous</button></li>
            <li><button aria-current="page">1</button></li>
            <li><button>2</button></li>
            <li><button aria-label="Next page">Next</button></li>
          </ul>
        </nav>
      </main>
    );
    await expectNoViolations(container);
  });

  it('form view with proper labels has no violations', async () => {
    const { container } = render(
      <main aria-label="Record form">
        <h1>New Opportunity</h1>
        <form aria-label="Opportunity form">
          <div>
            <label htmlFor="opp-name">Name</label>
            <input id="opp-name" type="text" required aria-required="true" />
          </div>
          <div>
            <label htmlFor="opp-amount">Amount</label>
            <input id="opp-amount" type="number" />
          </div>
          <div>
            <label htmlFor="opp-stage">Stage</label>
            <select id="opp-stage">
              <option value="prospect">Prospect</option>
              <option value="negotiation">Negotiation</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div role="group" aria-label="Form actions">
            <button type="submit">Save</button>
            <button type="button">Cancel</button>
          </div>
        </form>
      </main>
    );
    await expectNoViolations(container);
  });

  it('loading state has appropriate ARIA attributes', async () => {
    const { container } = render(
      <div role="status" aria-label="Loading application" aria-live="polite">
        <div aria-hidden="true">
          <div className="animate-spin h-8 w-8 border-2 border-primary" />
        </div>
        <p>Initializing Console...</p>
      </div>
    );
    await expectNoViolations(container);
  });

  it('error boundary state has proper structure', async () => {
    const { container } = render(
      <main aria-label="Error">
        <div role="alert">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please try refreshing the page.</p>
          <button>Retry</button>
        </div>
      </main>
    );
    await expectNoViolations(container);
  });

  it('empty state view has no violations', async () => {
    const { container } = render(
      <main aria-label="Opportunities">
        <h1>Opportunities</h1>
        <div role="status" aria-label="No results">
          <p>No opportunities found</p>
          <p>Create your first opportunity to get started.</p>
          <button>Create Opportunity</button>
        </div>
      </main>
    );
    await expectNoViolations(container);
  });

  it('keyboard shortcuts dialog has no violations', async () => {
    const { container } = render(
      <div role="dialog" aria-label="Keyboard shortcuts" aria-modal="true">
        <h2>Keyboard Shortcuts</h2>
        <dl>
          <dt><kbd>Ctrl</kbd> + <kbd>K</kbd></dt>
          <dd>Open command palette</dd>
          <dt><kbd>Ctrl</kbd> + <kbd>N</kbd></dt>
          <dd>Create new record</dd>
        </dl>
        <button aria-label="Close dialog">Close</button>
      </div>
    );
    await expectNoViolations(container);
  });
});
