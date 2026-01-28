import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Map',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
    test: {
      timeout: 60000,
    },
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const StoreLocations: Story = {
  render: renderStory,
  args: {
    type: 'object-map',
    objectName: 'Store',
    map: {
      latitudeField: 'latitude',
      longitudeField: 'longitude',
      titleField: 'name',
      descriptionField: 'address'
    },
    locations: [
      {
        id: '1',
        name: 'Downtown Store',
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.0060
      },
      {
        id: '2',
        name: 'Uptown Branch',
        address: '456 Park Ave',
        latitude: 40.7589,
        longitude: -73.9851
      },
      {
        id: '3',
        name: 'Suburban Location',
        address: '789 Oak Rd',
        latitude: 40.6782,
        longitude: -73.9442
      }
    ],
    center: {
      latitude: 40.7128,
      longitude: -74.0060
    },
    zoom: 12,
    className: 'w-full h-[500px]'
  } as any,
};

export const DeliveryRoutes: Story = {
  render: renderStory,
  args: {
    type: 'object-map',
    objectName: 'Delivery',
    map: {
      latitudeField: 'lat',
      longitudeField: 'lng',
      titleField: 'address'
    },
    locations: [
      {
        id: '1',
        address: 'Customer A - 100 First St',
        lat: 37.7749,
        lng: -122.4194,
        status: 'Delivered'
      },
      {
        id: '2',
        address: 'Customer B - 200 Second Ave',
        lat: 37.7849,
        lng: -122.4094,
        status: 'In Transit'
      },
      {
        id: '3',
        address: 'Customer C - 300 Third Blvd',
        lat: 37.7649,
        lng: -122.4294,
        status: 'Pending'
      }
    ],
    center: {
      latitude: 37.7749,
      longitude: -122.4194
    },
    zoom: 13,
    className: 'w-full h-[500px]'
  } as any,
};
