/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Capture the initialData passed to ObjectForm
let capturedSchema: any = null;
let capturedOnSuccess: ((data: any) => void) | null = null;

vi.mock('../ObjectForm', () => ({
  ObjectForm: ({ schema, dataSource }: any) => {
    capturedSchema = schema;
    capturedOnSuccess = schema?.onSuccess ?? null;
    return (
      <div>
        <div data-testid="object-form">
          {schema?.initialData && (
            <div data-testid="initial-data">
              {JSON.stringify(schema.initialData)}
            </div>
          )}
        </div>
        <button
          data-testid="mock-submit"
          onClick={() => schema?.onSuccess?.({ name: 'submitted' })}
        >
          Submit
        </button>
      </div>
    );
  },
}));

vi.mock('@object-ui/types', () => ({
  // DataSource type is only used for typing, provide empty default
}));

import { EmbeddableForm } from '../EmbeddableForm';
import type { EmbeddableFormConfig } from '../EmbeddableForm';

const baseConfig: EmbeddableFormConfig = {
  formId: 'test-form',
  objectName: 'contacts',
  title: 'Test Form',
};

describe('EmbeddableForm - URL Prefill', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    capturedSchema = null;
    capturedOnSuccess = null;
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('reads URL search params and passes them as initialData', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '?name=John&email=john@test.com' },
    });

    render(<EmbeddableForm config={baseConfig} />);

    expect(capturedSchema).not.toBeNull();
    expect(capturedSchema.initialData).toEqual({
      name: 'John',
      email: 'john@test.com',
    });
  });

  it('passes explicit prefillParams as initialData', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '' },
    });

    render(
      <EmbeddableForm
        config={baseConfig}
        prefillParams={{ company: 'Acme', role: 'Admin' }}
      />
    );

    expect(capturedSchema.initialData).toEqual({
      company: 'Acme',
      role: 'Admin',
    });
  });

  it('explicit prefillParams override URL params for the same field', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '?name=URLName&email=url@test.com' },
    });

    render(
      <EmbeddableForm
        config={baseConfig}
        prefillParams={{ name: 'ExplicitName' }}
      />
    );

    // name should come from prefillParams, email should come from URL
    expect(capturedSchema.initialData).toEqual({
      name: 'ExplicitName',
      email: 'url@test.com',
    });
  });

  it('passes undefined initialData when no params are provided', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '' },
    });

    render(<EmbeddableForm config={baseConfig} />);

    expect(capturedSchema.initialData).toBeUndefined();
  });

  it('shows the thank-you page after successful submission', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '' },
    });

    render(
      <EmbeddableForm
        config={{
          ...baseConfig,
          thankYouPage: {
            title: 'All Done!',
            message: 'We got your response.',
          },
        }}
      />
    );

    // Form should be visible initially
    expect(screen.getByText('Test Form')).toBeInTheDocument();

    // Click mock submit to trigger onSuccess
    const submitBtn = screen.getByTestId('mock-submit');
    fireEvent.click(submitBtn);

    // Thank-you page should appear
    await waitFor(() => {
      expect(screen.getByText('All Done!')).toBeInTheDocument();
      expect(screen.getByText('We got your response.')).toBeInTheDocument();
    });

    // Form title should no longer be visible
    expect(screen.queryByText('Test Form')).not.toBeInTheDocument();
  });

  it('shows default thank-you message when no custom thankYouPage is configured', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '' },
    });

    render(<EmbeddableForm config={baseConfig} />);

    const submitBtn = screen.getByTestId('mock-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Thank You!')).toBeInTheDocument();
      expect(screen.getByText('Your submission has been received successfully.')).toBeInTheDocument();
    });
  });
});
