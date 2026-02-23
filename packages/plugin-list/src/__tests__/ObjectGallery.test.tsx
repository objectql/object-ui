/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectGallery } from '../ObjectGallery';

// Mock useDataScope, useSchemaContext, and useNavigationOverlay
const mockHandleClick = vi.fn();
const mockNavigationOverlay = {
  isOverlay: false,
  handleClick: mockHandleClick,
  selectedRecord: null,
  isOpen: false,
  close: vi.fn(),
  setIsOpen: vi.fn(),
  mode: 'page' as const,
  width: undefined,
  view: undefined,
  open: vi.fn(),
};

vi.mock('@object-ui/react', () => ({
  useDataScope: () => undefined,
  useSchemaContext: () => ({ dataSource: undefined }),
  useNavigationOverlay: () => mockNavigationOverlay,
}));

vi.mock('@object-ui/components', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  Card: ({ children, onClick, ...props }: any) => (
    <div data-testid="gallery-card" onClick={onClick} {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  NavigationOverlay: ({ children, selectedRecord }: any) => (
    selectedRecord ? <div data-testid="navigation-overlay">{children(selectedRecord)}</div> : null
  ),
}));

vi.mock('@object-ui/core', () => ({
  ComponentRegistry: { register: vi.fn() },
}));

const mockItems = [
  { id: '1', name: 'Item 1', image: 'https://example.com/1.jpg' },
  { id: '2', name: 'Item 2', image: 'https://example.com/2.jpg' },
];

describe('ObjectGallery', () => {
  it('renders gallery items', () => {
    const schema = { objectName: 'products' };
    render(<ObjectGallery schema={schema} data={mockItems} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('calls navigation.handleClick on card click', () => {
    const schema = {
      objectName: 'products',
      navigation: { mode: 'drawer' as const },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    const cards = screen.getAllByTestId('gallery-card');
    fireEvent.click(cards[0]);

    expect(mockHandleClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('renders with cursor-pointer when navigation is configured', () => {
    const schema = {
      objectName: 'products',
      navigation: { mode: 'drawer' as const },
    };
    render(<ObjectGallery schema={schema} data={mockItems} />);

    const cards = screen.getAllByTestId('gallery-card');
    expect(cards.length).toBe(2);
  });

  it('renders with cursor-pointer when onCardClick is provided', () => {
    const onCardClick = vi.fn();
    const schema = { objectName: 'products' };
    render(<ObjectGallery schema={schema} data={mockItems} onCardClick={onCardClick} />);

    const cards = screen.getAllByTestId('gallery-card');
    fireEvent.click(cards[0]);

    expect(mockHandleClick).toHaveBeenCalled();
  });

  // ============================
  // Spec GalleryConfig integration
  // ============================
  describe('Spec GalleryConfig', () => {
    it('schema.gallery.coverField drives cover image', () => {
      const data = [
        { id: '1', name: 'Photo A', photo: 'https://example.com/a.jpg' },
      ];
      const schema = {
        objectName: 'albums',
        gallery: { coverField: 'photo' },
      };
      render(<ObjectGallery schema={schema} data={data} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/a.jpg');
    });

    it('schema.gallery.cardSize controls grid layout class', () => {
      const data = [{ id: '1', name: 'Item', image: 'https://example.com/1.jpg' }];

      // small cards → more columns
      const { container: c1 } = render(
        <ObjectGallery schema={{ objectName: 'a', gallery: { cardSize: 'small' } }} data={data} />,
      );
      expect(c1.querySelector('[role="list"]')?.className).toContain('grid-cols-2');

      // large cards → fewer columns
      const { container: c2 } = render(
        <ObjectGallery schema={{ objectName: 'a', gallery: { cardSize: 'large' } }} data={data} />,
      );
      expect(c2.querySelector('[role="list"]')?.className).toContain('lg:grid-cols-3');
    });

    it('schema.gallery.coverFit applies object-contain class', () => {
      const data = [{ id: '1', name: 'Item', thumb: 'https://example.com/1.jpg' }];
      const schema = {
        objectName: 'items',
        gallery: { coverField: 'thumb', coverFit: 'contain' as const },
      };
      render(<ObjectGallery schema={schema} data={data} />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('object-contain');
    });

    it('schema.gallery.visibleFields shows additional fields on card', () => {
      const data = [
        { id: '1', name: 'Item 1', status: 'active', category: 'books' },
      ];
      const schema = {
        objectName: 'items',
        gallery: { visibleFields: ['status', 'category'] },
      };
      render(<ObjectGallery schema={schema} data={data} />);
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('books')).toBeInTheDocument();
    });

    it('schema.gallery.titleField overrides default title', () => {
      const data = [
        { id: '1', name: 'Default Name', displayName: 'Custom Title' },
      ];
      const schema = {
        objectName: 'items',
        gallery: { titleField: 'displayName' },
      };
      render(<ObjectGallery schema={schema} data={data} />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('falls back to legacy imageField when gallery.coverField is not set', () => {
      const data = [
        { id: '1', name: 'Item', legacyImg: 'https://example.com/legacy.jpg' },
      ];
      const schema = {
        objectName: 'items',
        imageField: 'legacyImg',
      };
      render(<ObjectGallery schema={schema} data={data} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/legacy.jpg');
    });

    it('falls back to legacy titleField when gallery.titleField is not set', () => {
      const data = [
        { id: '1', name: 'Default', label: 'Legacy Title' },
      ];
      const schema = {
        objectName: 'items',
        titleField: 'label',
      };
      render(<ObjectGallery schema={schema} data={data} />);
      expect(screen.getByText('Legacy Title')).toBeInTheDocument();
    });

    it('spec gallery.coverField takes priority over legacy imageField', () => {
      const data = [
        { id: '1', name: 'Item', photo: 'https://spec.com/a.jpg', oldImg: 'https://old.com/b.jpg' },
      ];
      const schema = {
        objectName: 'items',
        imageField: 'oldImg',
        gallery: { coverField: 'photo' },
      };
      render(<ObjectGallery schema={schema} data={data} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://spec.com/a.jpg');
    });
  });
});
