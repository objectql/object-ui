import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectForm } from './ObjectForm';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { registerAllFields } from '@object-ui/fields';
import React from 'react';
// @ts-ignore - Import from examples
import { ContactObject } from '../../../examples/crm/src/objects/contact.object';

// Register widget renderers
registerAllFields();

const BASE_URL = process.env.OBJECTSTACK_API_URL || 'http://localhost';

// --- Mock Data ---

const mockSchema = ContactObject;

const mockRecord = {
  _id: '1',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  status: 'Active'
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
    if (object === 'contact' && id === '1') {
      return HttpResponse.json(mockRecord);
    }
    return new HttpResponse(null, { status: 404 });
  })
];

const server = setupServer(...handlers);

// --- Test Suite ---

describe('ObjectForm with ObjectStack/MSW', () => {
  // Only start MSW if we are NOT using a real server
  if (!process.env.OBJECTSTACK_API_URL) {
    beforeAll(() => server.listen());
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());
  }

  // Create real adapter instance pointing to MSW or Real Server
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
      // Changed from 'Full Name' to 'Name' based on CRM example schema
      expect(screen.getByText('Name')).toBeInTheDocument();
    }, { timeout: 5000 }); // Increased timeout for CI environments
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('loads record data in edit mode', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contact',
          mode: 'edit',
          recordId: '1'
        }}
        dataSource={dataSource}
      />
    );

    // Initial load of schema logic + data fetch
    await waitFor(() => {
      // Changed from 'Full Name' to 'Name'
      expect(screen.getByRole('textbox', { name: /Name/i })).toHaveValue('Alice Johnson');
    }, { timeout: 2000 }); // Give slight buffer for network mock

    // Changed from 'Email Address' to 'Email'
    expect(screen.getByRole('textbox', { name: /Email/i })).toHaveValue('alice@example.com');
  });
});
