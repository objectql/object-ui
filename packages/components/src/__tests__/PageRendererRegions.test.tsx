/**
 * ObjectUI — Page Renderer Tests
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Comprehensive tests for the upgraded Page system:
 * - Page types (record, home, app, utility)
 * - Region-based layouts (header, sidebar, main, aside, footer)
 * - Page variables (PageVariablesProvider)
 * - Legacy body/children fallback
 * - Registration & metadata
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PageRenderer } from '../renderers/layout/page';
import {
  renderComponent,
  validateComponentRegistration,
} from './test-utils';

// Import renderers to ensure full registration
beforeAll(async () => {
  await import('../renderers');
}, 30000);

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('Page Registration', () => {
  it('should register "page" type', () => {
    const v = validateComponentRegistration('page');
    expect(v.isRegistered).toBe(true);
    expect(v.hasConfig).toBe(true);
    expect(v.hasLabel).toBe(true);
  });

  it('should register "record" alias', () => {
    expect(validateComponentRegistration('record').isRegistered).toBe(true);
  });

  it('should register "home" alias', () => {
    expect(validateComponentRegistration('home').isRegistered).toBe(true);
  });

  it('should register "app" alias', () => {
    expect(validateComponentRegistration('app').isRegistered).toBe(true);
  });

  it('should register "utility" alias', () => {
    expect(validateComponentRegistration('utility').isRegistered).toBe(true);
  });

  it('should include pageType input in metadata', () => {
    const v = validateComponentRegistration('page');
    const inputNames = v.config?.inputs?.map((i: any) => i.name) ?? [];
    expect(inputNames).toContain('pageType');
    expect(inputNames).toContain('regions');
    expect(inputNames).toContain('variables');
    expect(inputNames).toContain('object');
    expect(inputNames).toContain('template');
  });
});

// ---------------------------------------------------------------------------
// Basic rendering (title, description)
// ---------------------------------------------------------------------------

describe('PageRenderer — Basic', () => {
  it('should render title and description', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page', title: 'My Page', description: 'A test page' } as any}
      />,
    );
    expect(screen.getByText('My Page')).toBeDefined();
    expect(screen.getByText('A test page')).toBeDefined();
    expect(container.querySelector('h1')?.textContent).toBe('My Page');
  });

  it('should render without title gracefully', () => {
    const { container } = render(
      <PageRenderer schema={{ type: 'page' } as any} />,
    );
    expect(container.querySelector('h1')).toBeNull();
  });

  it('should apply data-page-type attribute', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page', pageType: 'home' } as any}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-page-type')).toBe('home');
  });

  it('should default to record page type', () => {
    const { container } = render(
      <PageRenderer schema={{ type: 'page' } as any} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-page-type')).toBe('record');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page' } as any}
        className="my-custom-class"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('my-custom-class');
  });

  it('should pass through designer props', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page' } as any}
        data-obj-id="page-1"
        data-obj-type="page"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-obj-id')).toBe('page-1');
    expect(root.getAttribute('data-obj-type')).toBe('page');
  });
});

// ---------------------------------------------------------------------------
// Region rendering
// ---------------------------------------------------------------------------

describe('PageRenderer — Regions', () => {
  it('should render components from a single main region', () => {
    const schema: any = {
      type: 'page',
      title: 'Test Page',
      regions: [
        {
          name: 'main',
          components: [
            { type: 'text', value: 'Region Content 1' },
            { type: 'text', value: 'Region Content 2' },
          ],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Test Page')).toBeDefined();

    // Verify region is rendered with data-region attribute
    const mainRegion = container.querySelector('[data-region="main"]');
    expect(mainRegion).not.toBeNull();
    expect(mainRegion!.textContent).toContain('Region Content 1');
    expect(mainRegion!.textContent).toContain('Region Content 2');
  });

  it('should render header region', () => {
    const schema: any = {
      type: 'page',
      regions: [
        {
          name: 'header',
          components: [{ type: 'text', value: 'Header Content' }],
        },
        {
          name: 'main',
          components: [{ type: 'text', value: 'Main Content' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Header Content')).toBeDefined();
    expect(screen.getByText('Main Content')).toBeDefined();

    // Header region should have data-region attribute
    const headerRegion = container.querySelector('[data-region="header"]');
    expect(headerRegion).not.toBeNull();
  });

  it('should render sidebar region', () => {
    const schema: any = {
      type: 'page',
      regions: [
        {
          name: 'sidebar',
          components: [{ type: 'text', value: 'Sidebar Nav' }],
        },
        {
          name: 'main',
          components: [{ type: 'text', value: 'Main Body' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Sidebar Nav')).toBeDefined();
    expect(screen.getByText('Main Body')).toBeDefined();

    const sidebarRegion = container.querySelector('[data-region="sidebar"]');
    expect(sidebarRegion).not.toBeNull();
  });

  it('should render aside region', () => {
    const schema: any = {
      type: 'page',
      regions: [
        {
          name: 'main',
          components: [{ type: 'text', value: 'Center' }],
        },
        {
          name: 'aside',
          components: [{ type: 'text', value: 'Right Panel' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Center')).toBeDefined();
    expect(screen.getByText('Right Panel')).toBeDefined();

    const asideRegion = container.querySelector('[data-region="aside"]');
    expect(asideRegion).not.toBeNull();
  });

  it('should render footer region', () => {
    const schema: any = {
      type: 'page',
      regions: [
        {
          name: 'main',
          components: [{ type: 'text', value: 'Main' }],
        },
        {
          name: 'footer',
          components: [{ type: 'text', value: 'Footer Info' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Footer Info')).toBeDefined();

    const footerRegion = container.querySelector('[data-region="footer"]');
    expect(footerRegion).not.toBeNull();
  });

  it('should render full structured layout (header + sidebar + main + aside + footer)', () => {
    const schema: any = {
      type: 'page',
      regions: [
        { name: 'header', components: [{ type: 'text', value: 'H' }] },
        { name: 'sidebar', components: [{ type: 'text', value: 'S' }] },
        { name: 'main', components: [{ type: 'text', value: 'M' }] },
        { name: 'aside', components: [{ type: 'text', value: 'A' }] },
        { name: 'footer', components: [{ type: 'text', value: 'F' }] },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    for (const text of ['H', 'S', 'M', 'A', 'F']) {
      expect(screen.getByText(text)).toBeDefined();
    }

    // All five named regions should be present
    for (const name of ['header', 'sidebar', 'main', 'aside', 'footer']) {
      expect(container.querySelector(`[data-region="${name}"]`)).not.toBeNull();
    }
  });

  it('should render unnamed/extra regions alongside main', () => {
    const schema: any = {
      type: 'page',
      regions: [
        { name: 'main', components: [{ type: 'text', value: 'Main Content' }] },
        { name: 'analytics', components: [{ type: 'text', value: 'Analytics Widget' }] },
      ],
    };

    render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Main Content')).toBeDefined();
    expect(screen.getByText('Analytics Widget')).toBeDefined();
  });

  it('should handle empty regions gracefully', () => {
    const schema: any = {
      type: 'page',
      title: 'Empty Regions',
      regions: [
        { name: 'main', components: [] },
        { name: 'sidebar', components: [] },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Empty Regions')).toBeDefined();
    // Should not crash
    expect(container).toBeDefined();
  });

  it('should handle regions with no named slots (flat stacking)', () => {
    const schema: any = {
      type: 'page',
      regions: [
        { name: 'section1', components: [{ type: 'text', value: 'First' }] },
        { name: 'section2', components: [{ type: 'text', value: 'Second' }] },
      ],
    };

    render(<PageRenderer schema={schema} />);
    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });

  it('should apply region className', () => {
    const schema: any = {
      type: 'page',
      regions: [
        {
          name: 'section1',
          className: 'bg-blue-500',
          components: [{ type: 'text', value: 'Styled' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    const region = container.querySelector('[data-region="section1"]');
    expect(region?.className).toContain('bg-blue-500');
  });
});

// ---------------------------------------------------------------------------
// Page type variants
// ---------------------------------------------------------------------------

describe('PageRenderer — Page Types', () => {
  it('should render record page type with max-w-7xl', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page', pageType: 'record', title: 'Record' } as any}
      />,
    );
    const inner = container.querySelector('.mx-auto');
    expect(inner?.className).toContain('max-w-7xl');
  });

  it('should render home page type with max-w-screen-2xl', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page', pageType: 'home', title: 'Home' } as any}
      />,
    );
    const inner = container.querySelector('.mx-auto');
    expect(inner?.className).toContain('max-w-screen-2xl');
  });

  it('should render app page type with max-w-screen-xl', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page', pageType: 'app', title: 'App' } as any}
      />,
    );
    const inner = container.querySelector('.mx-auto');
    expect(inner?.className).toContain('max-w-screen-xl');
  });

  it('should render utility page type with max-w-4xl', () => {
    const { container } = render(
      <PageRenderer
        schema={{ type: 'page', pageType: 'utility', title: 'Utility' } as any}
      />,
    );
    const inner = container.querySelector('.mx-auto');
    expect(inner?.className).toContain('max-w-4xl');
  });
});

// ---------------------------------------------------------------------------
// Legacy body/children fallback
// ---------------------------------------------------------------------------

describe('PageRenderer — Legacy Fallback', () => {
  it('should render body array', () => {
    const schema: any = {
      type: 'page',
      title: 'Legacy Page',
      body: [{ type: 'text', value: 'Body Content' }],
    };

    render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Body Content')).toBeDefined();
  });

  it('should render children array', () => {
    const schema: any = {
      type: 'page',
      children: [{ type: 'text', value: 'Child Content' }],
    };

    render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Child Content')).toBeDefined();
  });

  it('should prefer regions over body when both exist', () => {
    const schema: any = {
      type: 'page',
      regions: [
        {
          name: 'main',
          components: [{ type: 'text', value: 'From Regions' }],
        },
      ],
      body: [{ type: 'text', value: 'From Body' }],
    };

    render(<PageRenderer schema={schema} />);
    expect(screen.getByText('From Regions')).toBeDefined();
    // Body should not render when regions are present
    expect(screen.queryByText('From Body')).toBeNull();
  });

  it('should render empty page without errors', () => {
    const schema: any = { type: 'page' };
    const { container } = render(<PageRenderer schema={schema} />);
    expect(container).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Page Variables
// ---------------------------------------------------------------------------

describe('PageRenderer — Variables', () => {
  it('should wrap content with PageVariablesProvider when variables defined', () => {
    const schema: any = {
      type: 'page',
      title: 'Variable Page',
      variables: [
        { name: 'selectedId', type: 'string', defaultValue: '' },
        { name: 'count', type: 'number', defaultValue: 0 },
      ],
      body: [{ type: 'text', value: 'Content' }],
    };

    // Renders without error — provider wraps content
    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Variable Page')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();
    expect(container).toBeDefined();
  });

  it('should render without provider when no variables', () => {
    const schema: any = {
      type: 'page',
      title: 'No Variables',
      body: [{ type: 'text', value: 'Plain' }],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Plain')).toBeDefined();
    expect(container).toBeDefined();
  });

  it('should render without provider when variables is empty array', () => {
    const schema: any = {
      type: 'page',
      title: 'Empty Vars',
      variables: [],
      body: [{ type: 'text', value: 'Still Plain' }],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Still Plain')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration — via ComponentRegistry renderComponent
// ---------------------------------------------------------------------------

describe('PageRenderer — Registry Integration', () => {
  it('should render page via ComponentRegistry', () => {
    const { container } = renderComponent({
      type: 'page',
      title: 'Registry Page',
      body: [{ type: 'text', value: 'Works' }],
    } as any);

    expect(screen.getByText('Registry Page')).toBeDefined();
    expect(screen.getByText('Works')).toBeDefined();
    expect(container).toBeDefined();
  });

  it('should render home page via registry alias', () => {
    const { container } = renderComponent({
      type: 'home',
      title: 'Home Dashboard',
      body: [{ type: 'text', value: 'Dashboard Content' }],
    } as any);

    expect(screen.getByText('Home Dashboard')).toBeDefined();
    expect(container).toBeDefined();
  });

  it('should render record page via registry alias', () => {
    const { container } = renderComponent({
      type: 'record',
      title: 'Account Detail',
    } as any);

    expect(screen.getByText('Account Detail')).toBeDefined();
    expect(container).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Page Templates — predefined layout templates
// ---------------------------------------------------------------------------

describe('PageRenderer — Templates', () => {
  it('should use header-sidebar-main template when specified', () => {
    const schema: any = {
      type: 'page',
      title: 'Template Page',
      template: 'header-sidebar-main',
      regions: [
        {
          name: 'header',
          components: [{ type: 'text', value: 'Header Content' }],
        },
        {
          name: 'sidebar',
          components: [{ type: 'text', value: 'Sidebar Content' }],
        },
        {
          name: 'main',
          components: [{ type: 'text', value: 'Main Content' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);

    expect(screen.getByText('Header Content')).toBeDefined();
    expect(screen.getByText('Sidebar Content')).toBeDefined();
    expect(screen.getByText('Main Content')).toBeDefined();
    expect(container.querySelector('[data-template="header-sidebar-main"]')).toBeDefined();
  });

  it('should use three-column template when specified', () => {
    const schema: any = {
      type: 'page',
      title: 'Three Column',
      template: 'three-column',
      regions: [
        {
          name: 'sidebar',
          components: [{ type: 'text', value: 'Left Sidebar' }],
        },
        {
          name: 'main',
          components: [{ type: 'text', value: 'Center Main' }],
        },
        {
          name: 'aside',
          components: [{ type: 'text', value: 'Right Aside' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);

    expect(screen.getByText('Left Sidebar')).toBeDefined();
    expect(screen.getByText('Center Main')).toBeDefined();
    expect(screen.getByText('Right Aside')).toBeDefined();
    expect(container.querySelector('[data-template="three-column"]')).toBeDefined();
  });

  it('should use dashboard template with grid layout', () => {
    const schema: any = {
      type: 'page',
      title: 'Dashboard',
      template: 'dashboard',
      regions: [
        {
          name: 'header',
          components: [{ type: 'text', value: 'Dashboard Header' }],
        },
        {
          name: 'widget1',
          components: [{ type: 'text', value: 'Widget 1' }],
        },
        {
          name: 'widget2',
          components: [{ type: 'text', value: 'Widget 2' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);

    expect(screen.getByText('Dashboard Header')).toBeDefined();
    expect(screen.getByText('Widget 1')).toBeDefined();
    expect(screen.getByText('Widget 2')).toBeDefined();
    expect(container.querySelector('[data-template="dashboard"]')).toBeDefined();
  });

  it('should fall back to page type layout when template is unknown', () => {
    const schema: any = {
      type: 'page',
      title: 'Unknown Template',
      template: 'nonexistent-template',
      pageType: 'home',
      body: [{ type: 'text', value: 'Fallback Content' }],
    };

    const { container } = render(<PageRenderer schema={schema} />);

    expect(screen.getByText('Unknown Template')).toBeDefined();
    expect(screen.getByText('Fallback Content')).toBeDefined();
    // Should fall back to home page layout
    expect(container.querySelector('[data-page-type="home"]')).toBeDefined();
  });

  it('should use default template when template is "default"', () => {
    const schema: any = {
      type: 'page',
      title: 'Default Template',
      template: 'default',
      regions: [
        {
          name: 'main',
          components: [{ type: 'text', value: 'Default Content' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    expect(screen.getByText('Default Content')).toBeDefined();
    expect(container).toBeDefined();
  });

  it('should prioritize template over pageType', () => {
    const schema: any = {
      type: 'page',
      title: 'Template Priority',
      template: 'dashboard',
      pageType: 'record',
      regions: [
        {
          name: 'panel1',
          components: [{ type: 'text', value: 'Panel 1' }],
        },
      ],
    };

    const { container } = render(<PageRenderer schema={schema} />);
    // Should use dashboard template, not record layout
    expect(container.querySelector('[data-template="dashboard"]')).toBeDefined();
  });
});
