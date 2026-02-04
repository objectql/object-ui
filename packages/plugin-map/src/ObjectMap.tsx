/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectMap Component
 * 
 * A specialized map visualization component that works with ObjectQL data sources.
 * Displays records as markers/pins on a map based on location data.
 * Implements the map view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Interactive map with markers
 * - Location-based data visualization
 * - Marker clustering (when many points)
 * - Popup/tooltip on marker click
 * - Works with object/api/value data providers
 * 
 * Note: This is a basic implementation. For production use, integrate with a
 * proper mapping library like Mapbox, Leaflet, or Google Maps.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { ObjectGridSchema, DataSource, ViewData } from '@object-ui/types';
import { z } from 'zod';

const MapConfigSchema = z.object({
  latitudeField: z.string().optional(),
  longitudeField: z.string().optional(),
  locationField: z.string().optional(),
  titleField: z.string().optional(),
  descriptionField: z.string().optional(),
  zoom: z.number().optional(),
  center: z.tuple([z.number(), z.number()]).optional(),
});

export interface ObjectMapProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onMarkerClick?: (record: any) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
}

interface MapConfig {
  /** Field containing latitude value */
  latitudeField?: string;
  /** Field containing longitude value */
  longitudeField?: string;
  /** Field containing combined location (e.g., "lat,lng" or location object) */
  locationField?: string;
  /** Field to use for marker title/label */
  titleField?: string;
  /** Field to use for marker description */
  descriptionField?: string;
  /** Default zoom level (1-20) */
  zoom?: number;
  /** Center coordinates [lat, lng] */
  center?: [number, number];
}

/**
 * Helper to get data configuration from schema
 */
function getDataConfig(schema: ObjectGridSchema): ViewData | null {
  if (schema.data) {
    return schema.data;
  }
  
  if (schema.staticData) {
    return {
      provider: 'value',
      items: schema.staticData,
    };
  }
  
  if (schema.objectName) {
    return {
      provider: 'object',
      object: schema.objectName,
    };
  }
  
  return null;
}

/**
 * Helper to convert sort config to QueryParams format
 */
function convertSortToQueryParams(sort: string | any[] | undefined): Record<string, 'asc' | 'desc'> | undefined {
  if (!sort) return undefined;
  
  // If it's a string like "name desc"
  if (typeof sort === 'string') {
    const parts = sort.split(' ');
    const field = parts[0];
    const order = (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
    return { [field]: order };
  }
  
  // If it's an array of SortConfig objects
  if (Array.isArray(sort)) {
    return sort.reduce((acc, item) => {
      if (item.field && item.order) {
        acc[item.field] = item.order;
      }
      return acc;
    }, {} as Record<string, 'asc' | 'desc'>);
  }
  
  return undefined;
}

/**
 * Helper to get map configuration from schema
 */
function getMapConfig(schema: ObjectGridSchema | any): MapConfig {
  // 1. Check top-level properties (ObjectMapSchema style)
  if (schema.locationField || schema.latitudeField) {
      return {
          locationField: schema.locationField,
          latitudeField: schema.latitudeField,
          longitudeField: schema.longitudeField,
          titleField: schema.titleField || 'name',
          descriptionField: schema.descriptionField,
          zoom: schema.zoom,
          center: schema.center
      };
  }

  let config: MapConfig | null = null;
  // Check if schema has map configuration
  if (schema.filter && typeof schema.filter === 'object' && 'map' in schema.filter) {
    config = (schema.filter as any).map as MapConfig;
  }
  
  // For backward compatibility, check if schema has map config at root
  else if ((schema as any).map) {
    config = (schema as any).map as MapConfig;
  }

  if (config) {
     const result = MapConfigSchema.safeParse(config);
     if (!result.success) {
       console.warn(`[ObjectMap] Invalid map configuration:`, result.error.format());
     }
     return config;
  }
  
  // Default configuration
  return {
    latitudeField: 'latitude',
    longitudeField: 'longitude',
    locationField: 'location',
    titleField: 'name',
    descriptionField: 'description',
    zoom: 10,
    center: [0, 0],
  };
}

/**
 * Extract coordinates from a record based on configuration
 */
function extractCoordinates(record: any, config: MapConfig): [number, number] | null {
  // Try latitude/longitude fields
  if (config.latitudeField && config.longitudeField) {
    const lat = record[config.latitudeField];
    const lng = record[config.longitudeField];
    if (typeof lat === 'number' && typeof lng === 'number') {
      return [lat, lng];
    }
  }

  // Try location field
  if (config.locationField) {
    const location = record[config.locationField];
    
    // Handle object format: { lat: number, lng: number }
    if (typeof location === 'object' && location !== null) {
      const lat = location.lat || location.latitude;
      const lng = location.lng || location.lon || location.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return [lat, lng];
      }
    }
    
    // Handle string format: "lat,lng"
    if (typeof location === 'string') {
      const parts = location.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    
    // Handle array format: [lat, lng]
    if (Array.isArray(location) && location.length === 2) {
      const lat = parseFloat(location[0]);
      const lng = parseFloat(location[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return [lat, lng];
      }
    }
  }

  return null;
}

export const ObjectMap: React.FC<ObjectMapProps> = ({
  schema,
  dataSource,
  className,
  onMarkerClick,
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const rawDataConfig = getDataConfig(schema);
  // Memoize dataConfig using deep comparison to prevent infinite loops
  const dataConfig = useMemo(() => {
    return rawDataConfig;
  }, [JSON.stringify(rawDataConfig)]);
  
  const mapConfig = getMapConfig(schema);
  const hasInlineData = dataConfig?.provider === 'value';

  // Fetch data based on provider
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Prioritize data passed via props (from ListView)
        if ((rest as any).data) { // Check props.data directly first
             const passed = (rest as any).data;
             if (Array.isArray(passed)) {
                 setData(passed);
                 setLoading(false);
                 return;
             }
        }

        // Check schema.data next
        if ((schema as any).data) {
             const passed = (schema as any).data;
             if (Array.isArray(passed)) {
                 setData(passed);
                 setLoading(false);
                 return;
             }
        }
        
        if (hasInlineData && dataConfig?.provider === 'value') {
          setData(dataConfig.items as any[]);
          setLoading(false);
          return;
        }

        if (!dataSource) {
          throw new Error('DataSource required for object/api providers');
        }

        if (dataConfig?.provider === 'object') {
          const objectName = dataConfig.object;
          const result = await dataSource.find(objectName, {
            $filter: schema.filter,
            $orderby: convertSortToQueryParams(schema.sort),
          });
          
          let items: any[] = [];
          if (Array.isArray(result)) {
            items = result;
          } else if (result && typeof result === 'object') {
             if (Array.isArray((result as any).data)) {
                items = (result as any).data; 
             } else if (Array.isArray((result as any).value)) {
                items = (result as any).value;
             }
          }
          setData(items);
        } else if (dataConfig?.provider === 'api') {
          console.warn('API provider not yet implemented for ObjectMap');
          setData([]);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchData();
  }, [dataConfig, dataSource, hasInlineData, schema.filter, schema.sort]);

  // Fetch object schema for field metadata
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!dataSource) return;
        
        const objectName = dataConfig?.provider === 'object' 
          ? dataConfig.object 
          : schema.objectName;
          
        if (!objectName) return;
        
        const schemaData = await dataSource.getObjectSchema(objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
      }
    };

    if (!hasInlineData && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, dataSource, hasInlineData, dataConfig]);

  // Transform data to map markers
  const markers = useMemo(() => {
    return data
      .map((record, index) => {
        const coordinates = extractCoordinates(record, mapConfig);
        if (!coordinates) return null;

        const title = mapConfig.titleField ? record[mapConfig.titleField] : 'Marker';
        const description = mapConfig.descriptionField ? record[mapConfig.descriptionField] : undefined;

        return {
          id: record.id || record._id || `marker-${index}`,
          title,
          description,
          coordinates,
          data: record,
        };
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker !== null);
  }, [data, mapConfig]);

  // Calculate map bounds
  const bounds = useMemo(() => {
    if (!markers.length) {
      return {
        center: mapConfig.center || [0, 0],
        minLat: (mapConfig.center?.[0] || 0) - 0.1,
        maxLat: (mapConfig.center?.[0] || 0) + 0.1,
        minLng: (mapConfig.center?.[1] || 0) - 0.1,
        maxLng: (mapConfig.center?.[1] || 0) + 0.1,
      };
    }

    const lats = markers.map(m => m.coordinates[0]);
    const lngs = markers.map(m => m.coordinates[1]);

    return {
      center: [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
      ] as [number, number],
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [markers, mapConfig.center]);

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
          <div className="text-muted-foreground">Loading map...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
          <div className="text-destructive">Error: {error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative border rounded-lg overflow-hidden bg-muted" style={{ height: '600px' }}>
        {/* Placeholder map - in production, replace with actual map library */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <div className="text-sm text-muted-foreground mb-4">
              Map Visualization (Placeholder)
            </div>
            <div className="text-xs text-muted-foreground max-w-md mx-auto">
              This is a basic map placeholder. For production, integrate with Mapbox, Leaflet, or Google Maps.
              <br />
              <br />
              <strong>Map Info:</strong>
              <br />
              Center: [{bounds.center[0].toFixed(4)}, {bounds.center[1].toFixed(4)}]
              <br />
              Markers: {markers.length}
            </div>
          </div>
        </div>

        {/* Marker List Overlay */}
        <div className="absolute top-4 right-4 w-64 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          <div className="p-3 border-b font-semibold bg-muted">
            Locations ({markers.length})
          </div>
          {markers.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No locations found with valid coordinates
            </div>
          ) : (
            <div>
              {markers.map(marker => (
                <div
                  key={marker.id}
                  className={`p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedMarker === marker.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => {
                    setSelectedMarker(marker.id);
                    onMarkerClick?.(marker.data);
                  }}
                >
                  <div className="font-medium text-sm">{marker.title}</div>
                  {marker.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {marker.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    📍 {marker.coordinates[0].toFixed(4)}, {marker.coordinates[1].toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-background border rounded-lg shadow-lg p-3">
          <div className="text-xs font-semibold mb-2">Legend</div>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Location Marker</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
