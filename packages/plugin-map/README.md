# @object-ui/plugin-map

Map visualization plugin for Object UI - Display geographic data with interactive maps.

## Features

- **Interactive Maps** - Zoomable, pannable map visualization
- **Markers** - Add markers with custom icons and popups
- **Layers** - Multiple map layers support
- **Geolocation** - User location detection
- **Customizable** - Tailwind CSS styling support
- **Responsive** - Mobile-friendly map controls

## Installation

```bash
pnpm add @object-ui/plugin-map
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-map';

// Now you can use map types in your schemas
const schema = {
  type: 'map',
  center: { lat: 37.7749, lng: -122.4194 },
  zoom: 12,
  markers: [
    { lat: 37.7749, lng: -122.4194, label: 'San Francisco' }
  ]
};
```

### Manual Registration

```typescript
import { mapComponents } from '@object-ui/plugin-map';
import { ComponentRegistry } from '@object-ui/core';

// Register map components
Object.entries(mapComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

## Schema API

### Map

Display an interactive map:

```typescript
{
  type: 'map',
  center: { lat: number, lng: number },
  zoom?: number,                  // Default: 10
  markers?: MapMarker[],
  layers?: MapLayer[],
  height?: number | string,
  onMarkerClick?: (marker) => void,
  className?: string
}
```

### Map Marker

```typescript
interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  icon?: string;                  // Icon URL or name
  popup?: string | ReactNode;
  color?: string;                 // Marker color
}
```

## Examples

### Basic Map

```typescript
const schema = {
  type: 'map',
  center: { lat: 40.7128, lng: -74.0060 },
  zoom: 13,
  height: 500,
  markers: [
    {
      lat: 40.7128,
      lng: -74.0060,
      label: 'New York City',
      popup: 'The Big Apple'
    }
  ]
};
```

### Multiple Markers

```typescript
const schema = {
  type: 'map',
  center: { lat: 37.7749, lng: -122.4194 },
  zoom: 10,
  markers: [
    {
      lat: 37.7749,
      lng: -122.4194,
      label: 'San Francisco',
      color: 'red',
      popup: 'Golden Gate Bridge'
    },
    {
      lat: 37.8044,
      lng: -122.2712,
      label: 'Oakland',
      color: 'blue',
      popup: 'Port of Oakland'
    },
    {
      lat: 37.3382,
      lng: -121.8863,
      label: 'San Jose',
      color: 'green',
      popup: 'Silicon Valley'
    }
  ]
};
```

### Interactive Map

```typescript
const schema = {
  type: 'map',
  center: { lat: 51.5074, lng: -0.1278 },
  zoom: 12,
  markers: [/* markers */],
  onMarkerClick: (marker) => {
    console.log('Marker clicked:', marker);
    // Show marker details
  },
  onMapClick: (coordinates) => {
    console.log('Map clicked at:', coordinates);
    // Add new marker
  }
};
```

### Map with Data Binding

```typescript
const schema = {
  type: 'map',
  center: { lat: 37.7749, lng: -122.4194 },
  zoom: 10,
  markers: '${data.locations.map(loc => ({ lat: loc.latitude, lng: loc.longitude, label: loc.name }))}',
  onMarkerClick: (marker) => {
    // Handle marker click
  }
};
```

## Integration with ObjectQL

Connect map to ObjectStack data sources:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'object-map',
  dataSource,
  object: 'locations',
  latField: 'latitude',
  lngField: 'longitude',
  labelField: 'name',
  popupField: 'description',
  center: { lat: 37.7749, lng: -122.4194 },
  zoom: 10
};
```

## Map Features

### Custom Markers

```typescript
const schema = {
  type: 'map',
  markers: [
    {
      lat: 40.7128,
      lng: -74.0060,
      icon: '/custom-marker.png',
      popup: {
        type: 'card',
        title: 'Location Details',
        body: 'Custom popup content'
      }
    }
  ]
};
```

### Geolocation

```typescript
const schema = {
  type: 'map',
  useGeolocation: true,           // Center map on user's location
  zoom: 15,
  markers: []
};
```

### Map Layers

```typescript
const schema = {
  type: 'map',
  center: { lat: 37.7749, lng: -122.4194 },
  layers: [
    { type: 'heatmap', data: [/* heatmap data */] },
    { type: 'polygon', coordinates: [/* polygon coordinates */], color: 'rgba(255, 0, 0, 0.3)' }
  ]
};
```

## TypeScript Support

```typescript
import type { MapSchema, MapMarker } from '@object-ui/plugin-map';

const marker: MapMarker = {
  lat: 37.7749,
  lng: -122.4194,
  label: 'San Francisco',
  color: 'red'
};

const map: MapSchema = {
  type: 'map',
  center: { lat: 37.7749, lng: -122.4194 },
  zoom: 12,
  markers: [marker]
};
```

## Customization

Style the map with Tailwind classes:

```typescript
const schema = {
  type: 'map',
  className: 'rounded-lg shadow-xl border-2 border-gray-200',
  height: '600px',
  center: { lat: 37.7749, lng: -122.4194 }
};
```

## License

MIT
