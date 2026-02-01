import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectForm } from './ObjectForm';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { registerAllFields } from '@object-ui/fields';
import React from 'react';

// Register widget renderers
registerAllFields();

const BASE_URL = 'http://test-api.com';

// --- Mock Data ---

const mockSchema = {
  name: 'contact',
  label: 'Contact',
  fields: {
    name: { 
      type: 'text', 
      label: 'Full Name',
      required: true 
    },
    email: { 
      type: 'email', 
      label: 'Email Address' 
    },
    status: {
      type: 'select',
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' }
      ]
    }
  }
};

const mockRecord = {
  _id: 'rec_123',
  name: 'Alice Smith',
  email: 'alice@example.com',
  status: 'active'
};

// --- MSW Setup ---

const handlers = [
  // OPTIONS handler for CORS preflight
  http.options(`${BASE_URL}/*`, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,CONNECT,OPTIONS,TRACE,PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
  
  // Health check / Connection check (ObjectStackClient often pings root or /api/v1)
  http.get(`${BASE_URL}/api/v1`, () => {
    return HttpResponse.json({ status: 'ok', version: '1.0.0' });
  }),

  // Mock Schema Fetch: GET /api/v1/metadata/object/:name
  http.get(`${BASE_URL}/api/v1/metadata/object/:name`, ({ params }) => {
    const { name } = params;
    if (name === 'contact') {
      return HttpResponse.json(mockSchema);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  // Mock Record Fetch: GET /api/v1/data/:object/:id
  http.get(`${BASE_URL}/api/v1/data/:object/:id`, ({ params }) => {
    const { object, id } = params;
    if (object === 'contact' && id === 'rec_123') {
      return HttpResponse.json(mockRecord);
    }
    return new HttpResponse(null, { status: 404 });
  })
];

const server = setupServer(...handlers);

// --- Test Suite ---

describe('ObjectForm with ObjectStack/MSW', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  // Create real adapter instance pointing to MSW
  const dataSource = new ObjectStackAdapter({
    baseUrl: BASE_URL,
    // Add custom fetch for environment that might need it, or rely on global fetch
    // fetch: global.fetch 
  });

  it('loads schema and renders form fields', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contact', // Triggers schema fetch
          mode: 'create'
        }}
        dataSource={dataSource} // Logic moves from mock fn to real adapter + MSW
      />
    );

    // Verify fields appear (async as schema loads via HTTP)
    await waitFor(() => {
      expect(screen.getByText('Full Name')).toBeInTheDocument();
    });
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('loads record data in edit mode', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contact',
          mode: 'edit',
          recordId: 'rec_123'
        }}
        dataSource={dataSource}
      />
    );

    // Initial load of schema logic + data fetch
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Full Name/i })).toHaveValue('Alice Smith');
    }, { timeout: 2000 }); // Give slight buffer for network mock

    expect(screen.getByRole('textbox', { name: /Email Address/i })).toHaveValue('alice@example.com');
  });
});
