import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectCalendar } from './ObjectCalendar';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import React from 'react';

const BASE_URL = 'http://localhost';

// --- Mock Data ---

const mockEvents = {
  value: [
    { 
      _id: '1', 
      title: 'Meeting with Client', 
      start: new Date().toISOString(), 
      end: new Date(Date.now() + 3600000).toISOString(),
      type: 'business'
    },
    { 
      _id: '2', 
      title: 'Team Lunch', 
      start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      type: 'personal'
    }
  ]
};

// --- MSW Setup ---

const handlers = [
  http.options('*', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get(`${BASE_URL}/api/v1`, () => {
    return HttpResponse.json({ status: 'ok', version: '1.0.0' });
  }),

  // Data Query: GET /api/v1/data/events
  http.get(`${BASE_URL}/api/v1/data/events`, () => {
    return HttpResponse.json(mockEvents);
  }),

  // Metadata Query
  http.get(`${BASE_URL}/api/v1/meta/object/events`, () => {
    return HttpResponse.json({ fields: {} });
  })
];

const server = setupServer(...handlers);

// --- Test Suite ---

describe('ObjectCalendar with MSW', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('fetches events and renders them', async () => {
    const dataSource = new ObjectStackAdapter({
      baseUrl: BASE_URL,
    });

    render(
      <ObjectCalendar
        schema={{
          type: 'calendar',
          objectName: 'events',
          // Calendar specific config usually goes into 'calendar' prop or implicit mapping
          calendar: {
             dateField: 'start',
             endDateField: 'end',
             titleField: 'title'
          }
        }}
        dataSource={dataSource}
      />
    );

    // Verify events appear
    await waitFor(() => {
        expect(screen.getByText('Meeting with Client')).toBeInTheDocument();
    });
    
    // Check subsequent events (might need navigation depending on view, 
    // but default month view usually shows current month dates)
    // Note: If today is near end of month, tomorrow might be in next month view.
    // However, the test event is "now", so it should be visible.
    
    // We can just assert the first event for now.
  });
});
