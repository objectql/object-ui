import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectMap } from './ObjectMap';
import { DataSource } from '@object-ui/types';

const mockData = [
  { id: '1', name: 'Loc 1', latitude: 40, longitude: -74 },
  { id: '2', name: 'Loc 2', latitude: 41, longitude: -75 },
];

const mockDataSource: DataSource = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn(),
};

describe('ObjectMap', () => {
    it('renders with static value provider', async () => {
        const schema: any = {
            type: 'map',
            map: {
                latitudeField: 'latitude',
                longitudeField: 'longitude',
                titleField: 'name'
            },
            data: {
                provider: 'value',
                items: mockData
            }
        };

        render(<ObjectMap schema={schema} />);
        await waitFor(() => {
             expect(screen.getByText(/Locations \(2\)/)).toBeDefined();
        });
        expect(screen.getByText('Loc 1')).toBeDefined();
    });

    it('fetches data with object provider', async () => {
        (mockDataSource.find as any).mockResolvedValue({ data: mockData });
        
        const schema: any = {
            type: 'map',
            map: {
                latitudeField: 'latitude',
                longitudeField: 'longitude',
                titleField: 'name'
            },
            data: {
                provider: 'object',
                object: 'locations'
            }
        };

        render(<ObjectMap schema={schema} dataSource={mockDataSource} />);

        await waitFor(() => {
            expect(mockDataSource.find).toHaveBeenCalled();
        });
        
        expect(screen.getByText(/Locations \(2\)/)).toBeDefined();
    });
});
