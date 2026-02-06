/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import type { ICellRendererParams, ICellEditorParams } from 'ag-grid-community';
import type { FieldMetadata } from '@object-ui/types';

// Import field widgets
import {
  TextField,
  NumberField,
  BooleanField,
  SelectField,
  DateField,
  DateTimeField,
  TimeField,
  EmailField,
  PhoneField,
  UrlField,
  CurrencyField,
  PercentField,
  PasswordField,
  TextAreaField,
  ColorField,
  RatingField,
  ImageField,
  AvatarField,
  LookupField,
  SliderField,
  CodeField,
} from '@object-ui/fields';

/**
 * Map field type to field widget component
 */
function getFieldWidget(fieldType: string): React.ComponentType<any> | null {
  const widgetMap: Record<string, React.ComponentType<any>> = {
    text: TextField,
    textarea: TextAreaField,
    number: NumberField,
    currency: CurrencyField,
    percent: PercentField,
    boolean: BooleanField,
    select: SelectField,
    date: DateField,
    datetime: DateTimeField,
    time: TimeField,
    email: EmailField,
    phone: PhoneField,
    url: UrlField,
    password: PasswordField,
    color: ColorField,
    rating: RatingField,
    image: ImageField,
    avatar: AvatarField,
    lookup: LookupField,
    slider: SliderField,
    code: CodeField,
  };

  return widgetMap[fieldType] || null;
}

/**
 * AG Grid Cell Renderer using Field Widgets (Read-only mode)
 */
export class FieldWidgetCellRenderer {
  public eGui!: HTMLDivElement;
  public root: any;

  init(params: ICellRendererParams & { field: FieldMetadata }) {
    const { value, field } = params;
    const FieldWidget = getFieldWidget(field.type);

    this.eGui = document.createElement('div');
    this.eGui.className = 'field-widget-cell';

    if (FieldWidget) {
      this.root = createRoot(this.eGui);
      this.root.render(
        <FieldWidget
          value={value}
          onChange={() => {}} // No-op for read-only mode
          field={field}
          readonly={true}
        />
      );
    } else {
      // Fallback to text display
      this.eGui.textContent = value != null ? String(value) : '';
    }
  }

  getGui() {
    return this.eGui;
  }

  refresh(params: ICellRendererParams & { field: FieldMetadata }): boolean {
    const { value, field } = params;
    const FieldWidget = getFieldWidget(field.type);

    if (FieldWidget && this.root) {
      this.root.render(
        <FieldWidget
          value={value}
          onChange={() => {}} // No-op for read-only mode
          field={field}
          readonly={true}
        />
      );
      return true;
    }

    return false;
  }

  destroy() {
    if (this.root) {
      this.root.unmount();
    }
  }
}

/**
 * AG Grid Cell Editor using Field Widgets (Edit mode)
 */
export class FieldWidgetCellEditor {
  public eGui!: HTMLDivElement;
  public root: any;
  public currentValue: any;
  public params!: ICellEditorParams & { field: FieldMetadata };

  init(params: ICellEditorParams & { field: FieldMetadata }) {
    this.params = params;
    this.currentValue = params.value;
    const { field } = params;
    const FieldWidget = getFieldWidget(field.type);

    this.eGui = document.createElement('div');
    this.eGui.className = 'field-widget-editor';

    if (FieldWidget) {
      this.root = createRoot(this.eGui);
      this.root.render(
        <FieldWidget
          value={this.currentValue}
          onChange={(newValue: any) => {
            this.currentValue = newValue;
          }}
          field={field}
          readonly={false}
        />
      );
    } else {
      // Fallback to input element
      const input = document.createElement('input');
      input.value = this.currentValue != null ? String(this.currentValue) : '';
      input.className = 'ag-input-field-input ag-text-field-input';
      input.addEventListener('input', (e) => {
        this.currentValue = (e.target as HTMLInputElement).value;
      });
      this.eGui.appendChild(input);
      setTimeout(() => input.focus(), 0);
    }
  }

  getGui() {
    return this.eGui;
  }

  getValue() {
    return this.currentValue;
  }

  destroy() {
    if (this.root) {
      this.root.unmount();
    }
  }

  isPopup(): boolean {
    // Return true for complex widgets that need more space
    const popupTypes = ['date', 'datetime', 'select', 'lookup', 'color'];
    return popupTypes.includes(this.params.field.type);
  }
}

/**
 * Factory function to create cell renderer with field metadata
 */
export function createFieldCellRenderer(field: FieldMetadata) {
  return class extends FieldWidgetCellRenderer {
    init(params: ICellRendererParams) {
      super.init({ ...params, field });
    }
    refresh(params: ICellRendererParams): boolean {
      return super.refresh({ ...params, field });
    }
  };
}

/**
 * Factory function to create cell editor with field metadata
 */
export function createFieldCellEditor(field: FieldMetadata) {
  return class extends FieldWidgetCellEditor {
    init(params: ICellEditorParams) {
      super.init({ ...params, field });
    }
  };
}
