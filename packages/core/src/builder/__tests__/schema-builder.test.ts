import { describe, it, expect } from 'vitest';
import { form, crud, button, input, card, grid, flex } from '../../builder/schema-builder';

describe('SchemaBuilder', () => {
  describe('form()', () => {
    it('creates a basic form schema', () => {
      const schema = form().id('test-form').build();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('form');
      expect(schema.id).toBe('test-form');
    });

    it('supports field definitions', () => {
      const schema = form()
        .field({ name: 'email', label: 'Email', type: 'string' })
        .build();
      expect(schema.fields).toHaveLength(1);
      expect(schema.fields![0].name).toBe('email');
    });

    it('supports bulk fields', () => {
      const schema = form()
        .fields([
          { name: 'first_name', label: 'First Name', type: 'string' },
          { name: 'last_name', label: 'Last Name', type: 'string' },
        ])
        .build();
      expect(schema.fields).toHaveLength(2);
    });

    it('supports default values', () => {
      const schema = form()
        .defaultValues({ status: 'active' })
        .build();
      expect(schema.defaultValues).toEqual({ status: 'active' });
    });

    it('supports submit label', () => {
      const schema = form()
        .submitLabel('Create')
        .build();
      expect(schema.submitLabel).toBe('Create');
    });

    it('supports layout option', () => {
      const schema = form()
        .layout('vertical')
        .build();
      expect(schema.layout).toBe('vertical');
    });

    it('supports columns', () => {
      const schema = form()
        .columns(2)
        .build();
      expect(schema.columns).toBe(2);
    });

    it('supports chaining', () => {
      const schema = form()
        .id('chained')
        .field({ name: 'name', label: 'Name', type: 'string' })
        .submitLabel('Submit')
        .layout('horizontal')
        .columns(3)
        .build();
      expect(schema.id).toBe('chained');
      expect(schema.fields).toHaveLength(1);
      expect(schema.submitLabel).toBe('Submit');
      expect(schema.layout).toBe('horizontal');
      expect(schema.columns).toBe(3);
    });
  });

  describe('crud()', () => {
    it('creates a basic CRUD schema', () => {
      const schema = crud().id('test-crud').build();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('crud');
      expect(schema.id).toBe('test-crud');
    });

    it('supports resource definition', () => {
      const schema = crud()
        .resource('users')
        .build();
      expect(schema.resource).toBe('users');
    });

    it('supports column definitions', () => {
      const schema = crud()
        .column({ name: 'name', label: 'Name' })
        .build();
      expect(schema.columns).toHaveLength(1);
      expect(schema.columns![0].name).toBe('name');
    });

    it('supports bulk columns', () => {
      const schema = crud()
        .columns([
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name' },
        ])
        .build();
      expect(schema.columns).toHaveLength(2);
    });

    it('supports CRUD operations', () => {
      const schema = crud()
        .api('/api/users')
        .enableCreate()
        .enableUpdate()
        .enableDelete()
        .build();
      expect(schema.operations).toBeDefined();
      expect(schema.operations!.create.enabled).toBe(true);
      expect(schema.operations!.update.enabled).toBe(true);
      expect(schema.operations!.delete.enabled).toBe(true);
    });

    it('supports pagination', () => {
      const schema = crud()
        .pagination(25)
        .build();
      expect(schema.pagination).toBeDefined();
      expect(schema.pagination!.enabled).toBe(true);
      expect(schema.pagination!.pageSize).toBe(25);
    });
  });

  describe('button()', () => {
    it('creates a button schema', () => {
      const schema = button().id('btn').build();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('button');
      expect(schema.id).toBe('btn');
    });

    it('supports label', () => {
      const schema = button()
        .label('Click Me')
        .build();
      expect(schema.label).toBe('Click Me');
    });

    it('supports variant', () => {
      const schema = button()
        .variant('destructive')
        .build();
      expect(schema.variant).toBe('destructive');
    });
  });

  describe('input()', () => {
    it('creates an input schema', () => {
      const schema = input().id('my-input').build();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('input');
      expect(schema.id).toBe('my-input');
    });

    it('supports label and placeholder', () => {
      const schema = input()
        .label('Username')
        .placeholder('Enter username')
        .build();
      expect(schema.label).toBe('Username');
      expect(schema.placeholder).toBe('Enter username');
    });
  });

  describe('card()', () => {
    it('creates a card schema', () => {
      const schema = card().id('my-card').build();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('card');
      expect(schema.id).toBe('my-card');
    });
  });

  describe('grid()', () => {
    it('creates a grid schema', () => {
      const schema = grid().id('my-grid').build();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('grid');
      expect(schema.id).toBe('my-grid');
    });
  });

  describe('flex()', () => {
    it('creates a flex schema', () => {
      const schema = flex().id('my-flex').build();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('flex');
      expect(schema.id).toBe('my-flex');
    });

    it('supports direction', () => {
      const schema = flex()
        .direction('row')
        .build();
      expect(schema.direction).toBe('row');
    });
  });

  describe('common builder properties', () => {
    it('supports className', () => {
      const schema = button()
        .className('my-class')
        .build();
      expect(schema.className).toBe('my-class');
    });

    it('supports visible', () => {
      const schema = button()
        .visible(false)
        .build();
      expect(schema.visible).toBe(false);
    });

    it('supports disabled', () => {
      const schema = button()
        .disabled(true)
        .build();
      expect(schema.disabled).toBe(true);
    });

    it('supports testId', () => {
      const schema = button()
        .testId('test-btn')
        .build();
      expect(schema.testId).toBe('test-btn');
    });
  });
});
