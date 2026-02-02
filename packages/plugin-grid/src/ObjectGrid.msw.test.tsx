import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectGrid } from './ObjectGrid';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { registerAllFields } from '@object-ui/fields';
import React from 'react';
// @ts-expect-error - Import from examples
import { ContactObject } from '../../../examples/crm/src/objects/contact.object';

registerAllFields();

const BASE_URL = process.env.OBJECTSTACK_API_URL || 'http://localhost';

// --- Mock Data ---

const mockSchema = ContactObject;

const mockData = {
  value: [
    { _id: '1', name: 'John Doe', email: 'john@example.com', company: 'Acme Inc' },
    { _id: '2', name: 'Jane Smith', email: 'jane@test.com', company: 'Globex' },
    { _id: '3', name: 'Bob Wilson', email: 'bob@test.com', company: 'Acme Inc' }
  ],
  count: 3,
  '@odata.count': 3
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
  
  // Health check / Connection check
  http.get(`${BASE_URL}/api/v1`, () => {
    return HttpResponse.json({ status: 'ok', version: '1.0.0' });
  }),

  // Schema: /api/v1/meta/object/:name
  http.get(`${BASE_URL}/api/v1/meta/object/contact`, () => {
    return HttpResponse.json(mockSchema);
  }),

  // Data Query: /api/v1/data/contact
  http.get(`${BASE_URL}/api/v1/data/contact`, () => {
    return HttpResponse.json(mockData);
  })
];

const server = setupServer(...handlers);

// --- Test Suite ---

describe('ObjectGrid with ObjectStack/MSW', () => {
    // Only start MSW if we are NOT using a real server
    if (!process.env.OBJECTSTACK_API_URL) {
        beforeAll(() => server.listen());
        afterEach(() => server.resetHandlers());
        afterAll(() => server.close());
    }

    const dataSource = new ObjectStackAdapter({
        baseUrl: BASE_URL,
    });

    it('loads schema and data rows', async () => {
        render(
            <ObjectGrid
                schema={{
                    type: 'object-grid',
                    objectName: 'contact',
                    columns: ['name', 'email', 'company'] // Explicit columns or auto-derived
                }}
                dataSource={dataSource}
            />
        );

        // Verify Column Headers (from schema or props)
        await waitFor(() => {
            // Changed from 'Full Name' to 'Name' to match CRM example schema
            expect(screen.getByText('Name')).toBeInTheDocument();
        });
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Company')).toBeInTheDocument();

        // Verify Data Rows
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
        expect(screen.getByText('jane@test.com')).toBeInTheDocument();
        expect(screen.getByText('Globex')).toBeInTheDocument();

        // Check Row Count (if grid displays it)
        // expect(screen.getByText(/3 records/i)).toBeInTheDocument();
    });
});
