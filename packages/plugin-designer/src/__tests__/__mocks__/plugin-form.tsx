/**
 * Mock for @object-ui/plugin-form used in plugin-designer tests.
 * Renders a simple form that exposes schema callbacks.
 */
import React from 'react';

export const ModalForm: React.FC<any> = ({ schema }) => {
  if (!schema || schema.open === false) return null;

  const handleSubmit = () => {
    if (schema.onSuccess) {
      schema.onSuccess(schema.initialValues || {});
    }
  };

  return (
    <div data-testid="mock-modal-form">
      <span data-testid="modal-title">{schema.title}</span>
      <span data-testid="modal-mode">{schema.mode}</span>
      <button data-testid="modal-submit" onClick={handleSubmit}>
        Submit
      </button>
      <button
        data-testid="modal-cancel"
        onClick={() => schema.onOpenChange?.(false)}
      >
        Cancel
      </button>
    </div>
  );
};

export const DrawerForm: React.FC<any> = ({ schema }) => {
  if (!schema || schema.open === false) return null;

  return (
    <div data-testid="mock-drawer-form">
      <span>{schema.title}</span>
    </div>
  );
};
