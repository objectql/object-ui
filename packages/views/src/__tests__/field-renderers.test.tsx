/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  TextCellRenderer,
  NumberCellRenderer,
  CurrencyCellRenderer,
  PercentCellRenderer,
  BooleanCellRenderer,
  DateCellRenderer,
  DateTimeCellRenderer,
  SelectCellRenderer,
  EmailCellRenderer,
  UrlCellRenderer,
  PhoneCellRenderer,
  FileCellRenderer,
  ImageCellRenderer,
  LookupCellRenderer,
  FormulaCellRenderer,
  UserCellRenderer,
  getCellRenderer,
} from '../field-renderers';

import type { FieldMetadata } from '@object-ui/types';

describe('Field Renderers', () => {
  describe('TextCellRenderer', () => {
    it('renders text value', () => {
      const field: FieldMetadata = { type: 'text', name: 'firstName' };
      const { container } = render(<TextCellRenderer value="John" field={field} />);
      expect(container.textContent).toBe('John');
    });

    it('renders dash for empty value', () => {
      const field: FieldMetadata = { type: 'text', name: 'firstName' };
      const { container } = render(<TextCellRenderer value={null} field={field} />);
      expect(container.textContent).toBe('-');
    });
  });

  describe('NumberCellRenderer', () => {
    it('renders number with precision', () => {
      const field = { type: 'number', name: 'quantity', precision: 2 } as FieldMetadata;
      const { container } = render(<NumberCellRenderer value={123.456} field={field} />);
      expect(container.textContent).toBe('123.46');
    });

    it('renders dash for null value', () => {
      const field = { type: 'number', name: 'quantity' } as FieldMetadata;
      const { container } = render(<NumberCellRenderer value={null} field={field} />);
      expect(container.textContent).toBe('-');
    });
  });

  describe('CurrencyCellRenderer', () => {
    it('renders currency with USD format', () => {
      const field = { type: 'currency', name: 'price', currency: 'USD' } as FieldMetadata;
      const { container } = render(<CurrencyCellRenderer value={1234.56} field={field} />);
      expect(container.textContent).toContain('$1,234.56');
    });

    it('renders dash for null value', () => {
      const field = { type: 'currency', name: 'price' } as FieldMetadata;
      const { container } = render(<CurrencyCellRenderer value={null} field={field} />);
      expect(container.textContent).toBe('-');
    });
  });

  describe('PercentCellRenderer', () => {
    it('renders percent with precision', () => {
      const field = { type: 'percent', name: 'discount', precision: 2 } as FieldMetadata;
      const { container } = render(<PercentCellRenderer value={0.2534} field={field} />);
      expect(container.textContent).toBe('25.34%');
    });
  });

  describe('BooleanCellRenderer', () => {
    it('renders checkmark for true', () => {
      const field = { type: 'boolean', name: 'active' } as FieldMetadata;
      const { container } = render(<BooleanCellRenderer value={true} field={field} />);
      expect(container.textContent).toContain('True');
    });

    it('renders cross for false', () => {
      const field = { type: 'boolean', name: 'active' } as FieldMetadata;
      const { container } = render(<BooleanCellRenderer value={false} field={field} />);
      expect(container.textContent).toContain('False');
    });
  });

  describe('DateCellRenderer', () => {
    it('renders formatted date', () => {
      const field = { type: 'date', name: 'birthDate' } as FieldMetadata;
      const { container } = render(
        <DateCellRenderer value="2024-01-15" field={field} />
      );
      // Check for month abbreviation (locale-dependent)
      expect(container.textContent).toMatch(/Jan|15|2024/);
    });

    it('renders dash for invalid date', () => {
      const field = { type: 'date', name: 'birthDate' } as FieldMetadata;
      const { container } = render(<DateCellRenderer value="invalid" field={field} />);
      expect(container.textContent).toBe('-');
    });
  });

  describe('SelectCellRenderer', () => {
    it('renders single select badge', () => {
      const field = {
        type: 'select',
        name: 'status',
        options: [
          { value: 'active', label: 'Active', color: 'green' },
          { value: 'inactive', label: 'Inactive', color: 'gray' },
        ],
      } as FieldMetadata;
      
      const { container } = render(<SelectCellRenderer value="active" field={field} />);
      expect(container.textContent).toBe('Active');
    });

    it('renders multiple select badges', () => {
      const field = {
        type: 'select',
        name: 'tags',
        multiple: true,
        options: [
          { value: 'vip', label: 'VIP', color: 'red' },
          { value: 'partner', label: 'Partner', color: 'blue' },
        ],
      } as FieldMetadata;
      
      const { container } = render(
        <SelectCellRenderer value={['vip', 'partner']} field={field} />
      );
      expect(container.textContent).toContain('VIP');
      expect(container.textContent).toContain('Partner');
    });
  });

  describe('EmailCellRenderer', () => {
    it('renders clickable email link', () => {
      const field = { type: 'email', name: 'email' } as FieldMetadata;
      const { container } = render(
        <EmailCellRenderer value="test@example.com" field={field} />
      );
      const link = container.querySelector('a');
      expect(link?.getAttribute('href')).toBe('mailto:test@example.com');
      expect(link?.textContent).toBe('test@example.com');
    });
  });

  describe('UrlCellRenderer', () => {
    it('renders clickable URL', () => {
      const field = { type: 'url', name: 'website' } as FieldMetadata;
      const { container } = render(
        <UrlCellRenderer value="https://example.com" field={field} />
      );
      const link = container.querySelector('a');
      expect(link?.getAttribute('href')).toBe('https://example.com');
      expect(link?.getAttribute('target')).toBe('_blank');
    });
  });

  describe('PhoneCellRenderer', () => {
    it('renders clickable phone link', () => {
      const field = { type: 'phone', name: 'phone' } as FieldMetadata;
      const { container } = render(
        <PhoneCellRenderer value="+1-555-123-4567" field={field} />
      );
      const link = container.querySelector('a');
      expect(link?.getAttribute('href')).toBe('tel:+1-555-123-4567');
    });
  });

  describe('FileCellRenderer', () => {
    it('renders single file name', () => {
      const field = { type: 'file', name: 'attachment' } as FieldMetadata;
      const file = { name: 'document.pdf' };
      const { container } = render(<FileCellRenderer value={file} field={field} />);
      expect(container.textContent).toBe('document.pdf');
    });

    it('renders multiple files count', () => {
      const field = { type: 'file', name: 'attachments', multiple: true } as FieldMetadata;
      const files = [
        { name: 'doc1.pdf' },
        { name: 'doc2.pdf' },
        { name: 'doc3.pdf' },
      ];
      const { container } = render(<FileCellRenderer value={files} field={field} />);
      expect(container.textContent).toContain('3 files');
    });
  });

  describe('ImageCellRenderer', () => {
    it('renders single image thumbnail', () => {
      const field = { type: 'image', name: 'avatar' } as FieldMetadata;
      const image = { url: 'https://example.com/avatar.jpg', name: 'Avatar' };
      const { container } = render(<ImageCellRenderer value={image} field={field} />);
      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toBe('https://example.com/avatar.jpg');
    });

    it('renders multiple image thumbnails', () => {
      const field = { type: 'image', name: 'photos', multiple: true } as FieldMetadata;
      const images = [
        { url: 'https://example.com/1.jpg', name: 'Photo 1' },
        { url: 'https://example.com/2.jpg', name: 'Photo 2' },
      ];
      const { container } = render(<ImageCellRenderer value={images} field={field} />);
      const imgs = container.querySelectorAll('img');
      expect(imgs.length).toBe(2);
    });
  });

  describe('LookupCellRenderer', () => {
    it('renders related record name', () => {
      const field = { type: 'lookup', name: 'account' } as FieldMetadata;
      const record = { _id: '123', name: 'Acme Corp' };
      const { container } = render(<LookupCellRenderer value={record} field={field} />);
      expect(container.textContent).toBe('Acme Corp');
    });

    it('renders multiple related records', () => {
      const field = { type: 'lookup', name: 'tags', multiple: true } as FieldMetadata;
      const records = [
        { _id: '1', name: 'Tag 1' },
        { _id: '2', name: 'Tag 2' },
      ];
      const { container } = render(<LookupCellRenderer value={records} field={field} />);
      expect(container.textContent).toContain('Tag 1');
      expect(container.textContent).toContain('Tag 2');
    });
  });

  describe('FormulaCellRenderer', () => {
    it('renders computed value in monospace', () => {
      const field = { type: 'formula', name: 'fullName' } as FieldMetadata;
      const { container } = render(<FormulaCellRenderer value="John Doe" field={field} />);
      expect(container.textContent).toBe('John Doe');
      expect(container.querySelector('.font-mono')).toBeTruthy();
    });
  });

  describe('UserCellRenderer', () => {
    it('renders user with avatar', () => {
      const field = { type: 'user', name: 'owner' } as FieldMetadata;
      const user = { name: 'John Doe', username: 'jdoe' };
      const { container } = render(<UserCellRenderer value={user} field={field} />);
      expect(container.textContent).toContain('JD'); // Initials
      expect(container.textContent).toContain('John Doe');
    });

    it('renders multiple users', () => {
      const field = { type: 'user', name: 'assignedTo', multiple: true } as FieldMetadata;
      const users = [
        { name: 'John Doe' },
        { name: 'Jane Smith' },
      ];
      const { container } = render(<UserCellRenderer value={users} field={field} />);
      // Avatar component creates nested elements, so we look for the Avatar data-slot attribute instead
      const avatars = container.querySelectorAll('[data-slot="avatar"]');
      expect(avatars.length).toBe(2);
    });
  });

  describe('getCellRenderer', () => {
    it('returns correct renderer for field type', () => {
      expect(getCellRenderer('text')).toBe(TextCellRenderer);
      expect(getCellRenderer('number')).toBe(NumberCellRenderer);
      expect(getCellRenderer('currency')).toBe(CurrencyCellRenderer);
      expect(getCellRenderer('percent')).toBe(PercentCellRenderer);
      expect(getCellRenderer('boolean')).toBe(BooleanCellRenderer);
      expect(getCellRenderer('date')).toBe(DateCellRenderer);
      expect(getCellRenderer('select')).toBe(SelectCellRenderer);
      expect(getCellRenderer('email')).toBe(EmailCellRenderer);
      expect(getCellRenderer('url')).toBe(UrlCellRenderer);
      expect(getCellRenderer('phone')).toBe(PhoneCellRenderer);
      expect(getCellRenderer('file')).toBe(FileCellRenderer);
      expect(getCellRenderer('image')).toBe(ImageCellRenderer);
      expect(getCellRenderer('lookup')).toBe(LookupCellRenderer);
      expect(getCellRenderer('formula')).toBe(FormulaCellRenderer);
      expect(getCellRenderer('user')).toBe(UserCellRenderer);
    });

    it('returns TextCellRenderer for unknown types', () => {
      expect(getCellRenderer('unknown')).toBe(TextCellRenderer);
    });
  });
});
