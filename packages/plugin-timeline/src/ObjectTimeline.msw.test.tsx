import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectTimeline } from './ObjectTimeline';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import React from 'react';

const BASE_URL = 'http://localhost';

// --- Mock Data ---

const mockMilestones = {
  value: [
    { _id: '1', title: 'Start Project', due_date: '2023-01-01', description: 'Initial Kickoff' },
    { _id: '2', title: 'Beta Launch', due_date: '2023-06-01', description: 'Public Beta' },
    { _id: '3', title: 'Release', due_date: '2023-12-01', description: 'v1.0 Release' }
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

  http.get(`${BASE_URL}/api/v1/data/milestones`, () => {
    return HttpResponse.json(mockMilestones);
  })
];

const server = setupServer(...handlers);

// --- Test Suite ---

describe('ObjectTimeline with MSW', () => {
    beforeAll(() => server.listen());
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    it('fetches and renders timeline items from object data', async () => {
        const adapter = new ObjectStackAdapter({
            baseUrl: BASE_URL,
            bucket: 'test-bucket'
        });

        const schema = {
            type: 'timeline',
            objectName: 'milestones',
            variant: 'vertical',
            titleField: 'title',
            dateField: 'due_date',
            descriptionField: 'description'
        };

        render(
            <ObjectTimeline 
                // @ts-ignore
                schema={schema}
                dataSource={adapter}
            />
        );

        // Wait for items to appear
        await waitFor(() => {
            expect(screen.getByText('Start Project')).toBeInTheDocument();
        });

        expect(screen.getByText('Beta Launch')).toBeInTheDocument();
        expect(screen.getByText('Release')).toBeInTheDocument();
        
        // Check descriptions if rendered
        expect(screen.getByText('Initial Kickoff')).toBeInTheDocument();
    });
});
