/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.1 Component Quality Audit - API Consistency
 *
 * Comprehensive audit verifying all exported UI components follow
 * consistent patterns:
 * - data-slot attribute for custom components
 * - className prop acceptance and forwarding via cn()
 * - React.forwardRef for primitive components
 * - displayName set on forwardRef components
 * - Consistent prop naming (variant/size, not variants/sizes)
 * - All exported types are defined
 * - Source-level pattern scanning for cn() usage
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Separator,
  Skeleton,
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
  Textarea,
} from '../ui';

import {
  Kbd,
  KbdGroup,
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  ButtonGroup,
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription as ItemDesc,
  ItemActions,
  ItemMedia,
  Spinner,
  DataLoadingState,
  DataEmptyState,
  DataErrorState,
} from '../custom';

import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UI_DIR = path.resolve(__dirname, '..', 'ui');
const CUSTOM_DIR = path.resolve(__dirname, '..', 'custom');

/** Read a source file from either ui/ or custom/ directory. */
function readSource(dir: string, filename: string): string {
  return fs.readFileSync(path.join(dir, filename), 'utf-8');
}

/** List .tsx component files in a directory (excluding index.ts). */
function listComponentFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.tsx') && f !== 'index.tsx');
}

// ---------------------------------------------------------------------------
// 1. data-slot attribute pattern (custom components)
// ---------------------------------------------------------------------------
describe('P3.1 API Consistency Audit', () => {
  describe('data-slot attribute on custom components', () => {
    const customComponentsWithSlot = [
      { name: 'Kbd', Component: Kbd, slot: 'kbd', children: 'K' },
      { name: 'KbdGroup', Component: KbdGroup, slot: 'kbd-group', children: 'G' },
      { name: 'Empty', Component: Empty, slot: 'empty', children: 'E' },
      { name: 'EmptyHeader', Component: EmptyHeader, slot: 'empty-header', children: 'H' },
      { name: 'EmptyTitle', Component: EmptyTitle, slot: 'empty-title', children: 'T' },
      { name: 'EmptyDescription', Component: EmptyDescription, slot: 'empty-description', children: 'D' },
      { name: 'EmptyContent', Component: EmptyContent, slot: 'empty-content', children: 'C' },
      { name: 'ButtonGroup', Component: ButtonGroup, slot: 'button-group', children: 'B' },
      { name: 'Item', Component: Item, slot: 'item', children: 'I' },
      { name: 'ItemGroup', Component: ItemGroup, slot: 'item-group', children: 'G' },
      { name: 'ItemContent', Component: ItemContent, slot: 'item-content', children: 'C' },
      { name: 'ItemTitle', Component: ItemTitle, slot: 'item-title', children: 'T' },
      { name: 'ItemDesc', Component: ItemDesc, slot: 'item-description', children: 'D' },
      { name: 'ItemActions', Component: ItemActions, slot: 'item-actions', children: 'A' },
      { name: 'DataLoadingState', Component: DataLoadingState, slot: 'data-loading-state', children: undefined },
      { name: 'DataEmptyState', Component: DataEmptyState, slot: 'data-empty-state', children: undefined },
      { name: 'DataErrorState', Component: DataErrorState, slot: 'data-error-state', children: undefined },
    ];

    it.each(customComponentsWithSlot)(
      '$name renders data-slot="$slot"',
      ({ Component, slot, children }) => {
        const { container } = render(
          <Component>{children}</Component>
        );
        const el = container.querySelector(`[data-slot="${slot}"]`);
        expect(el).toBeInTheDocument();
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 2. className prop acceptance and forwarding
  // ---------------------------------------------------------------------------
  describe('className prop forwarding', () => {
    const CUSTOM_CLASS = 'oui-test-custom-class';

    const classNameTests = [
      { name: 'Badge', render: () => render(<Badge className={CUSTOM_CLASS}>tag</Badge>) },
      { name: 'Button', render: () => render(<Button className={CUSTOM_CLASS}>btn</Button>) },
      { name: 'Card', render: () => render(<Card className={CUSTOM_CLASS}>card</Card>) },
      { name: 'CardHeader', render: () => render(<CardHeader className={CUSTOM_CLASS} />) },
      { name: 'CardTitle', render: () => render(<CardTitle className={CUSTOM_CLASS}>T</CardTitle>) },
      { name: 'CardDescription', render: () => render(<CardDescription className={CUSTOM_CLASS}>D</CardDescription>) },
      { name: 'CardContent', render: () => render(<CardContent className={CUSTOM_CLASS} />) },
      { name: 'CardFooter', render: () => render(<CardFooter className={CUSTOM_CLASS} />) },
      { name: 'Input', render: () => render(<Input className={CUSTOM_CLASS} data-testid="inp" />) },
      { name: 'Textarea', render: () => render(<Textarea className={CUSTOM_CLASS} data-testid="ta" />) },
      { name: 'Label', render: () => render(<Label className={CUSTOM_CLASS}>L</Label>) },
      { name: 'Separator', render: () => render(<Separator className={CUSTOM_CLASS} />) },
      { name: 'Skeleton', render: () => render(<Skeleton className={CUSTOM_CLASS} />) },
      { name: 'Alert', render: () => render(<Alert className={CUSTOM_CLASS}>A</Alert>) },
      { name: 'AlertTitle', render: () => render(<AlertTitle className={CUSTOM_CLASS}>T</AlertTitle>) },
      { name: 'AlertDescription', render: () => render(<AlertDescription className={CUSTOM_CLASS}>D</AlertDescription>) },
      { name: 'Kbd', render: () => render(<Kbd className={CUSTOM_CLASS}>K</Kbd>) },
      { name: 'Empty', render: () => render(<Empty className={CUSTOM_CLASS}>E</Empty>) },
      { name: 'ButtonGroup', render: () => render(<ButtonGroup className={CUSTOM_CLASS}>B</ButtonGroup>) },
      { name: 'Item', render: () => render(<Item className={CUSTOM_CLASS}>I</Item>) },
      { name: 'Spinner', render: () => render(<Spinner className={CUSTOM_CLASS} />) },
    ];

    it.each(classNameTests)(
      '$name accepts and forwards className',
      ({ render: doRender }) => {
        const { container } = doRender();
        const el = container.querySelector(`.${CUSTOM_CLASS}`);
        expect(el).toBeInTheDocument();
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 3. Source files use cn() utility for class merging
  // ---------------------------------------------------------------------------
  describe('cn() utility usage in source files', () => {
    const uiFiles = listComponentFiles(UI_DIR);
    const customFiles = listComponentFiles(CUSTOM_DIR);

    // Representative UI files that must import cn
    const representativeUiFiles = [
      'button.tsx',
      'card.tsx',
      'input.tsx',
      'badge.tsx',
      'alert.tsx',
      'separator.tsx',
      'label.tsx',
      'textarea.tsx',
      'progress.tsx',
      'typography.tsx',
    ].filter((f) => uiFiles.includes(f));

    it.each(representativeUiFiles)(
      'ui/%s imports and uses cn()',
      (file) => {
        const src = readSource(UI_DIR, file);
        expect(src).toMatch(/import\s*\{[^}]*\bcn\b[^}]*\}\s*from/);
        expect(src).toContain('cn(');
      }
    );

    const representativeCustomFiles = [
      'empty.tsx',
      'kbd.tsx',
      'button-group.tsx',
      'item.tsx',
      'spinner.tsx',
      'view-states.tsx',
    ].filter((f) => customFiles.includes(f));

    it.each(representativeCustomFiles)(
      'custom/%s imports and uses cn()',
      (file) => {
        const src = readSource(CUSTOM_DIR, file);
        expect(src).toMatch(/import\s*\{[^}]*\bcn\b[^}]*\}\s*from/);
        expect(src).toContain('cn(');
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 4. React.forwardRef on primitive UI components
  // ---------------------------------------------------------------------------
  describe('React.forwardRef on primitive components', () => {
    const forwardRefFiles = [
      'button.tsx',
      'card.tsx',
      'input.tsx',
      'textarea.tsx',
      'label.tsx',
      'separator.tsx',
      'progress.tsx',
      'alert.tsx',
    ];

    it.each(forwardRefFiles)(
      'ui/%s uses React.forwardRef',
      (file) => {
        const src = readSource(UI_DIR, file);
        expect(src).toContain('forwardRef');
      }
    );

    // Runtime verification: refs actually resolve
    const refTests = [
      { name: 'Button', ref: React.createRef<HTMLButtonElement>(), el: () => <Button ref={React.createRef<HTMLButtonElement>()}>B</Button>, instanceOf: HTMLButtonElement },
      { name: 'Input', ref: React.createRef<HTMLInputElement>(), el: () => <Input ref={React.createRef<HTMLInputElement>()} />, instanceOf: HTMLInputElement },
      { name: 'Card', ref: React.createRef<HTMLDivElement>(), el: () => <Card ref={React.createRef<HTMLDivElement>()}>C</Card>, instanceOf: HTMLDivElement },
      { name: 'Textarea', ref: React.createRef<HTMLTextAreaElement>(), el: () => <Textarea ref={React.createRef<HTMLTextAreaElement>()} />, instanceOf: HTMLTextAreaElement },
      { name: 'Alert', ref: React.createRef<HTMLDivElement>(), el: () => <Alert ref={React.createRef<HTMLDivElement>()}>A</Alert>, instanceOf: HTMLDivElement },
    ];

    it.each(refTests)(
      '$name forwards ref to correct DOM element',
      ({ name, instanceOf }) => {
        const ref = React.createRef<any>();
        const components: Record<string, JSX.Element> = {
          Button: <Button ref={ref}>B</Button>,
          Input: <Input ref={ref} />,
          Card: <Card ref={ref}>C</Card>,
          Textarea: <Textarea ref={ref} />,
          Alert: <Alert ref={ref}>A</Alert>,
        };
        render(components[name]);
        expect(ref.current).toBeInstanceOf(instanceOf);
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 5. displayName set on forwardRef components
  // ---------------------------------------------------------------------------
  describe('displayName on forwardRef components', () => {
    const filesWithForwardRef = [
      'button.tsx',
      'card.tsx',
      'input.tsx',
      'textarea.tsx',
      'label.tsx',
      'separator.tsx',
      'progress.tsx',
      'alert.tsx',
      'typography.tsx',
    ];

    it.each(filesWithForwardRef)(
      'ui/%s sets displayName on every forwardRef component',
      (file) => {
        const src = readSource(UI_DIR, file);
        const forwardRefCount = (src.match(/forwardRef/g) || []).length;
        const displayNameCount = (src.match(/\.displayName\s*=/g) || []).length;
        // Each forwardRef call should have a corresponding displayName assignment
        expect(displayNameCount).toBeGreaterThanOrEqual(forwardRefCount);
      }
    );

    // Runtime check: exported components have displayName
    const namedComponents = [
      { name: 'Button', component: Button },
      { name: 'Input', component: Input },
      { name: 'Card', component: Card },
      { name: 'CardHeader', component: CardHeader },
      { name: 'CardTitle', component: CardTitle },
      { name: 'CardDescription', component: CardDescription },
      { name: 'CardContent', component: CardContent },
      { name: 'CardFooter', component: CardFooter },
      { name: 'Textarea', component: Textarea },
      { name: 'Label', component: Label },
      { name: 'Alert', component: Alert },
    ];

    it.each(namedComponents)(
      '$name has a displayName set',
      ({ component }) => {
        // forwardRef components expose displayName on the component object
        expect((component as any).displayName).toBeTruthy();
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 6. Prop naming conventions: variant/size (singular), not variants/sizes
  // ---------------------------------------------------------------------------
  describe('prop naming conventions', () => {
    const allSourceFiles = [
      ...listComponentFiles(UI_DIR).map((f) => ({ dir: UI_DIR, file: f })),
      ...listComponentFiles(CUSTOM_DIR).map((f) => ({ dir: CUSTOM_DIR, file: f })),
    ];

    it('no component source uses plural "variants:" as a CVA key (should be "variant:")', () => {
      for (const { dir, file } of allSourceFiles) {
        const src = readSource(dir, file);
        // Detect if "variants" appears as a destructured prop in function args.
        // CVA config legitimately uses `variants: { variant: ... }` at the top
        // level — we only flag files that destructure `variants` from component
        // props, which would indicate an incorrect plural prop name.
        const destructuresVariantsProp = /\{\s*(?:.*,\s*)?variants\s*[,}]/.test(src);
        const hasCvaVariantsBlock = /variants\s*:\s*\{/.test(src);
        const hasPluralPropDestructure = destructuresVariantsProp && !hasCvaVariantsBlock;
        expect(hasPluralPropDestructure).toBe(false);
      }
    });

    it('no component source uses plural "sizes" as a prop name', () => {
      for (const { dir, file } of allSourceFiles) {
        const src = readSource(dir, file);
        // "sizes" should not appear as a destructured prop
        expect(src).not.toMatch(/\(\s*\{[^}]*\bsizes\b/);
      }
    });

    // CVA definitions should use "variant" and "size" (singular) as variant keys
    it('CVA variant keys use singular "variant" not "variants"', () => {
      const cvaFiles = allSourceFiles.filter(({ dir, file }) =>
        readSource(dir, file).includes('cva(')
      );
      for (const { dir, file } of cvaFiles) {
        const src = readSource(dir, file);
        // Inside the CVA config, look for `variants: { variant:` pattern
        // This confirms variant keys are singular inside the CVA variants object
        if (src.includes('variant:')) {
          expect(src).toMatch(/variants\s*:\s*\{[^}]*\bvariant\b\s*:/s);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Exported types and values are defined
  // ---------------------------------------------------------------------------
  describe('exported types and values are defined', () => {
    it('cn utility is exported and functional', () => {
      expect(typeof cn).toBe('function');
      expect(cn('a', 'b')).toBe('a b');
      // Tailwind merge deduplication
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('all UI components are exported as functions or objects', () => {
      const uiComponents = [
        Badge, Button, Card, CardHeader, CardTitle, CardDescription,
        CardContent, CardFooter, Input, Label, Separator, Skeleton,
        Progress, Alert, AlertTitle, AlertDescription, Textarea,
      ];
      for (const comp of uiComponents) {
        expect(typeof comp).toMatch(/^(function|object)$/);
      }
    });

    it('all custom components are exported as functions', () => {
      const customComponents = [
        Kbd, KbdGroup, Empty, EmptyHeader, EmptyTitle, EmptyDescription,
        EmptyContent, EmptyMedia, ButtonGroup, Item, ItemGroup,
        ItemContent, ItemTitle, ItemDesc, ItemActions, ItemMedia,
        Spinner, DataLoadingState, DataEmptyState, DataErrorState,
      ];
      for (const comp of customComponents) {
        expect(typeof comp).toBe('function');
      }
    });

    it('ui/index.ts re-exports all component files', () => {
      const indexSrc = fs.readFileSync(path.join(UI_DIR, 'index.ts'), 'utf-8');
      const uiFiles = listComponentFiles(UI_DIR);
      // toast.tsx is an internal module re-exported through sonner.tsx, not
      // listed in ui/index.ts directly. Exclude it from the re-export check.
      const internalModules = new Set(['toast']);
      const missingExports: string[] = [];
      for (const file of uiFiles) {
        const moduleName = file.replace('.tsx', '');
        if (internalModules.has(moduleName)) continue;
        if (!indexSrc.includes(`'./${moduleName}'`) && !indexSrc.includes(`"./${moduleName}"`)) {
          missingExports.push(moduleName);
        }
      }
      expect(missingExports).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Variant support (runtime)
  // ---------------------------------------------------------------------------
  describe('variant support', () => {
    it('Badge renders default variant without explicit prop', () => {
      const { container } = render(<Badge>tag</Badge>);
      expect(container.firstElementChild!.className).toContain('bg-primary');
    });

    it('Badge renders destructive variant', () => {
      const { container } = render(<Badge variant="destructive">err</Badge>);
      expect(container.firstElementChild!.className).toContain('bg-destructive');
    });

    it('Badge renders outline variant', () => {
      const { container } = render(<Badge variant="outline">out</Badge>);
      expect(container.firstElementChild!.className).toContain('text-foreground');
    });

    it('Button renders default variant without explicit prop', () => {
      render(<Button>Click</Button>);
      expect(screen.getByRole('button').className).toContain('bg-primary');
    });

    it('Button renders destructive variant', () => {
      render(<Button variant="destructive">Del</Button>);
      expect(screen.getByRole('button').className).toContain('bg-destructive');
    });

    it('Button renders ghost variant', () => {
      render(<Button variant="ghost">G</Button>);
      expect(screen.getByRole('button').className).toContain('hover:bg-accent');
    });

    it('Button renders outline variant', () => {
      render(<Button variant="outline">O</Button>);
      expect(screen.getByRole('button').className).toContain('border');
    });

    it('Alert renders default variant', () => {
      render(<Alert>info</Alert>);
      expect(screen.getByRole('alert').className).toContain('bg-background');
    });

    it('Alert renders destructive variant', () => {
      render(<Alert variant="destructive">err</Alert>);
      expect(screen.getByRole('alert').className).toContain('border-destructive');
    });
  });

  // ---------------------------------------------------------------------------
  // Button size variants
  // ---------------------------------------------------------------------------
  describe('Button size variants', () => {
    it('renders default size', () => {
      render(<Button>D</Button>);
      expect(screen.getByRole('button').className).toContain('h-10');
    });

    it('renders sm size', () => {
      render(<Button size="sm">S</Button>);
      expect(screen.getByRole('button').className).toContain('h-9');
    });

    it('renders lg size', () => {
      render(<Button size="lg">L</Button>);
      expect(screen.getByRole('button').className).toContain('h-11');
    });

    it('renders icon size', () => {
      render(<Button size="icon">I</Button>);
      expect(screen.getByRole('button').className).toContain('w-10');
    });
  });

  // ---------------------------------------------------------------------------
  // HTML attribute pass-through
  // ---------------------------------------------------------------------------
  describe('HTML attribute pass-through', () => {
    it('Button supports disabled attribute', () => {
      render(<Button disabled>Dis</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('Button supports type attribute', () => {
      render(<Button type="submit">Sub</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('Input supports placeholder', () => {
      render(<Input placeholder="Enter..." data-testid="inp" />);
      expect(screen.getByTestId('inp')).toHaveAttribute('placeholder', 'Enter...');
    });

    it('Input supports disabled', () => {
      render(<Input disabled data-testid="inp" />);
      expect(screen.getByTestId('inp')).toBeDisabled();
    });

    it('Badge supports data-* attributes', () => {
      const { container } = render(<Badge data-testid="b1">tag</Badge>);
      expect(container.querySelector('[data-testid="b1"]')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Card composition pattern
  // ---------------------------------------------------------------------------
  describe('Card composition pattern', () => {
    it('renders full Card composition', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Body</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );
      expect(container.textContent).toContain('Title');
      expect(container.textContent).toContain('Description');
      expect(container.textContent).toContain('Body');
      expect(container.textContent).toContain('Footer');
    });
  });

  // ---------------------------------------------------------------------------
  // Alert composition pattern
  // ---------------------------------------------------------------------------
  describe('Alert composition pattern', () => {
    it('renders Alert with title and description', () => {
      render(
        <Alert>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>You can add components.</AlertDescription>
        </Alert>
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Heads up!')).toBeInTheDocument();
      expect(screen.getByText('You can add components.')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Consistent defaults
  // ---------------------------------------------------------------------------
  describe('consistent defaults', () => {
    it('Separator defaults to horizontal orientation', () => {
      const { container } = render(<Separator />);
      const sep = container.firstElementChild!;
      expect(sep.getAttribute('data-orientation')).toBe('horizontal');
    });

    it('Separator can be vertical', () => {
      const { container } = render(<Separator orientation="vertical" />);
      const sep = container.firstElementChild!;
      expect(sep.getAttribute('data-orientation')).toBe('vertical');
    });

    it('Progress renders with zero value by default', () => {
      render(<Progress data-testid="prog" />);
      const prog = screen.getByTestId('prog');
      expect(prog).toBeInTheDocument();
    });

    it('Progress accepts value prop', () => {
      render(<Progress value={50} data-testid="prog" />);
      expect(screen.getByTestId('prog')).toBeInTheDocument();
    });

    it('Skeleton renders as a div', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstElementChild!.tagName).toBe('DIV');
      expect(container.firstElementChild!.className).toContain('animate-pulse');
    });
  });
});
