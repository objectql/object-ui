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
 * - Popup/tooltip on marker click
 * - Works with object/api/value data providers
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ObjectGridSchema, DataSource, ViewData } from '@object-ui/types';
import { useNavigationOverlay } from '@object-ui/react';
import { NavigationOverlay, cn, useIsMobile } from '@object-ui/components';
import { extractRecords, buildExpandFields } from '@object-ui/core';
import { z } from 'zod';
import MapGL, { NavigationControl, Marker, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapConfigSchema = z.object({
  latitudeField: z.string().optional(),
  longitudeField: z.string().optional(),
  locationField: z.string().optional(),
  titleField: z.string().optional(),
  descriptionField: z.string().optional(),
  zoom: z.number().optional(),
  center: z.tuple([z.number(), z.number()]).optional(),
  style: z.string().optional(),
});

/**
 * Public MapLibre demo style — free, unauthenticated, but not intended for
 * production traffic (rate-limited, no uptime guarantee). Used only when no
 * `style` is configured; a load failure surfaces the banner below rather
 * than failing silently.
 */
const DEFAULT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

export interface ObjectMapProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onMarkerClick?: (record: any) => void;
  onRowClick?: (record: any) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  /** Enable marker clustering for dense data */
  enableClustering?: boolean;
  /** Cluster radius in pixels (default: 50) */
  clusterRadius?: number;
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
  /** MapLibre style URL/spec (overrides the public demo default) */
  style?: string;
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
  // A custom style may be set alongside any of the shapes below — read it
  // once so every return path can carry it through.
  const style: string | undefined =
    (schema as any).style || (schema as any).mapStyle
    || (schema.filter as any)?.map?.style || (schema as any).map?.style;

  // 1. Check top-level properties (ObjectMapSchema style)
  if (schema.locationField || schema.latitudeField) {
      return {
          locationField: schema.locationField,
          latitudeField: schema.latitudeField,
          longitudeField: schema.longitudeField,
          titleField: schema.titleField || 'name',
          descriptionField: schema.descriptionField,
          zoom: schema.zoom,
          center: schema.center,
          style,
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
     return { ...config, style: config.style || style };
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
    style,
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

interface MarkerData {
  id: string;
  title: string;
  description?: string;
  coordinates: [number, number];
  data: any;
}

interface ClusterData {
  id: string;
  coordinates: [number, number];
  markers: MarkerData[];
  isCluster: boolean;
}

/**
 * Simple grid-based marker clustering.
 * Groups markers that are close to each other at a given zoom level.
 */
function clusterMarkers(markers: MarkerData[], zoom: number, radius: number = 50): ClusterData[] {
  if (markers.length <= 1 || zoom >= 15) {
    return markers.map(m => ({
      id: m.id,
      coordinates: m.coordinates,
      markers: [m],
      isCluster: false,
    }));
  }

  // Grid cell size based on zoom (larger cells at lower zoom)
  const cellSize = radius / Math.pow(2, zoom);
  const grid = new Map<string, MarkerData[]>();

  markers.forEach(marker => {
    const cellX = Math.floor(marker.coordinates[0] / cellSize);
    const cellY = Math.floor(marker.coordinates[1] / cellSize);
    const key = `${cellX}:${cellY}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(marker);
  });

  const clusters: ClusterData[] = [];
  grid.forEach((group, key) => {
    if (group.length === 1) {
      clusters.push({
        id: group[0].id,
        coordinates: group[0].coordinates,
        markers: group,
        isCluster: false,
      });
    } else {
      // Compute centroid
      const avgLng = group.reduce((sum, m) => sum + m.coordinates[0], 0) / group.length;
      const avgLat = group.reduce((sum, m) => sum + m.coordinates[1], 0) / group.length;
      clusters.push({
        id: `cluster-${key}`,
        coordinates: [avgLng, avgLat],
        markers: group,
        isCluster: true,
      });
    }
  });

  return clusters;
}

export const ObjectMap: React.FC<ObjectMapProps> = ({
  schema,
  dataSource,
  className,
  onMarkerClick,
  onRowClick,
  onEdit,
  onDelete,
  enableClustering,
  clusterRadius = 50,
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Mobile UX (round 3)
  const isMobile = useIsMobile();
  const mapRef = useRef<MapRef | null>(null);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  // Style/tile load failures (bad network, unreachable style server) don't
  // throw from react-map-gl — they emit an `error` event. Without this, a
  // failed load renders a blank map with no indication anything went wrong.
  const [mapStyleError, setMapStyleError] = useState<string | null>(null);
  const handleMapError = useCallback((e: { error?: Error & { status?: number } }) => {
    setMapStyleError(e?.error?.message || 'Failed to load the map style/tiles.');
  }, []);
  const requestUserLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }
    setGeoBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        setUserLocation({ lng: longitude, lat: latitude });
        setGeoBusy(false);
        try {
          mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 12, duration: 800 });
        } catch {
          /* mapRef may be null in some test envs */
        }
      },
      (err) => {
        setGeoBusy(false);
        setGeoError(err.message || 'Unable to retrieve location.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

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

        if (!dataSource || typeof dataSource.find !== 'function') {
          throw new Error('DataSource required for object/api providers');
        }

        if (dataConfig?.provider === 'object') {
          const objectName = dataConfig.object;
          // Auto-inject $expand for lookup/master_detail fields
          const expand = buildExpandFields(objectSchema?.fields);
          const result = await dataSource.find(objectName, {
            $filter: schema.filter,
            $orderby: convertSortToQueryParams(schema.sort),
            ...(expand.length > 0 ? { $expand: expand } : {}),
          });
          
          let items: any[] = extractRecords(result);
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
  }, [dataConfig, dataSource, hasInlineData, schema.filter, schema.sort, objectSchema]);

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
  const { markers, invalidCount } = useMemo(() => {
    let invalid = 0;
    const validMarkers = data
      .map((record, index) => {
        const coordinates = extractCoordinates(record, mapConfig);
        if (!coordinates) {
          invalid++;
          return null;
        }

        const title = mapConfig.titleField ? record[mapConfig.titleField] : 'Marker';
        const description = mapConfig.descriptionField ? record[mapConfig.descriptionField] : undefined;

        // Ensure lat/lng are within valid ranges
        const [lat, lng] = coordinates;
        if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            invalid++;
            return null;
        }

        return {
          id: record.id || record._id || `marker-${index}`,
          title,
          description,
          coordinates: [lng, lat] as [number, number], // maplibre uses [lng, lat]
          data: record,
        };
      })
      .filter((marker): marker is NonNullable<typeof marker> => marker !== null);

    return { markers: validMarkers, invalidCount: invalid };
  }, [data, mapConfig]);

  const selectedMarker = useMemo(() => 
    markers.find(m => m.id === selectedMarkerId),
  [markers, selectedMarkerId]);

  const [currentZoom, setCurrentZoom] = useState(mapConfig.zoom || 3);

  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick,
  });

  const filteredMarkers = useMemo(() => {
    if (!searchQuery.trim()) return markers;
    const q = searchQuery.toLowerCase();
    return markers.filter(m =>
      m.title?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    );
  }, [markers, searchQuery]);

  // Cluster markers when clustering is enabled
  const clusteredData = useMemo(() => {
    const shouldCluster = enableClustering ?? ((schema as any).enableClustering || filteredMarkers.length > 100);
    if (!shouldCluster) {
      return filteredMarkers.map(m => ({
        id: m.id,
        coordinates: m.coordinates,
        markers: [m],
        isCluster: false,
      }));
    }
    return clusterMarkers(filteredMarkers, currentZoom, clusterRadius);
  }, [filteredMarkers, currentZoom, enableClustering, clusterRadius, schema]);

  // Calculate map bounds
  const initialViewState = useMemo(() => {
    if (!filteredMarkers.length) {
      return {
        longitude: mapConfig.center?.[1] || 0,
        latitude: mapConfig.center?.[0] || 0,
        zoom: mapConfig.zoom || 2
      };
    }

    // Simple bounds calculation
    const lngs = filteredMarkers.map(m => m.coordinates[0]);
    const lats = filteredMarkers.map(m => m.coordinates[1]);
    
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    return {
      longitude: (minLng + maxLng) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: mapConfig.zoom || 3, // Auto-zoom logic could be improved here
    };
  }, [filteredMarkers, mapConfig]);

  if (loading) {
    return (
      <div className={cn("min-w-0 overflow-hidden", className)}>
        <div className="flex items-center justify-center h-96 bg-muted rounded-lg border">
          <div className="text-muted-foreground">Loading map...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("min-w-0 overflow-hidden", className)}>
        <div className="flex items-center justify-center h-96 bg-muted rounded-lg border">
          <div className="text-destructive">Error: {error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 overflow-hidden", className)}>
      {invalidCount > 0 && (
        <div className="mb-2 p-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded">
          {`${invalidCount} record${invalidCount !== 1 ? 's' : ''} with missing or invalid coordinates excluded from the map.`}
        </div>
      )}
      {markers.length > 0 && (
        <div className="mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search locations…"
            className="w-full px-3 py-2 text-sm border rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
      <div className="relative border rounded-lg overflow-hidden bg-muted h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] w-full">
         <MapGL
            ref={(r) => { mapRef.current = r as any; }}
            initialViewState={initialViewState}
            style={{ width: '100%', height: '100%' }}
            mapStyle={mapConfig.style || DEFAULT_MAP_STYLE}
            touchZoomRotate={true}
            dragRotate={true}
            touchPitch={true}
            onZoom={(e) => setCurrentZoom(Math.round(e.viewState.zoom))}
            onError={handleMapError}
         >
            {mapStyleError && (
              <div
                role="alert"
                className="absolute inset-x-0 top-0 z-20 p-2 text-sm text-center text-amber-900 bg-amber-50 border-b border-amber-200"
              >
                Map failed to load ({mapStyleError}). Markers below are still listed in the search box;{' '}
                {mapConfig.style ? 'check the configured map style URL.' : 'configure a custom map style for production use.'}
              </div>
            )}
            <NavigationControl position="top-right" showCompass={true} showZoom={true} />

            {/* Geolocation button — explicit user-initiated location request */}
            <button
              type="button"
              onClick={requestUserLocation}
              disabled={geoBusy}
              className="absolute top-2 left-2 z-10 inline-flex items-center justify-center size-9 rounded-md bg-background/95 border shadow-sm hover:bg-background disabled:opacity-50"
              aria-label="Show my location"
              data-testid="map-geolocate"
            >
              <span aria-hidden="true">{geoBusy ? '⏳' : '🧭'}</span>
            </button>

            {userLocation && (
              <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
                <div
                  className="size-3 rounded-full bg-blue-500 ring-4 ring-blue-500/30 shadow"
                  aria-label="Your location"
                  data-testid="map-user-location"
                />
              </Marker>
            )}

            {clusteredData.map(cluster => (
              cluster.isCluster ? (
                <Marker
                  key={cluster.id}
                  longitude={cluster.coordinates[0]}
                  latitude={cluster.coordinates[1]}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    // Cluster tap-through: zoom in toward the cluster center.
                    try {
                      const next = Math.min(20, Math.max(currentZoom + 2, 8));
                      mapRef.current?.flyTo({
                        center: [cluster.coordinates[0], cluster.coordinates[1]],
                        zoom: next,
                        duration: 600,
                      });
                    } catch { /* ignore */ }
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs cursor-pointer hover:scale-110 transition-transform shadow-md"
                    style={{
                      width: Math.min(48, 24 + cluster.markers.length * 2),
                      height: Math.min(48, 24 + cluster.markers.length * 2),
                    }}
                    title={`${cluster.markers.length} markers`}
                    data-testid="map-cluster"
                  >
                    {cluster.markers.length}
                  </div>
                </Marker>
              ) : (
                <Marker
                    key={cluster.id}
                    longitude={cluster.coordinates[0]}
                    latitude={cluster.coordinates[1]}
                    anchor="bottom"
                    onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        const marker = cluster.markers[0];
                        setSelectedMarkerId(marker.id);
                        navigation.handleClick(marker.data);
                        onMarkerClick?.(marker.data);
                    }}
                >
                    <div className="text-2xl cursor-pointer hover:scale-110 transition-transform">
                        📍
                    </div>
                </Marker>
              )
            ))}

            {selectedMarker && !isMobile && (
                <Popup
                    longitude={selectedMarker.coordinates[0]}
                    latitude={selectedMarker.coordinates[1]}
                    anchor="top"
                    onClose={() => setSelectedMarkerId(null)}
                    closeOnClick={false}
                >
                    <div className="p-2 min-w-[150px] sm:min-w-[200px]">
                        <h3 className="font-bold text-sm mb-1">{selectedMarker.title}</h3>
                        {selectedMarker.description && (
                            <p className="text-xs text-muted-foreground">{selectedMarker.description}</p>
                        )}
                        <div className="mt-2 text-xs flex gap-2">
                             {onEdit && (
                                <button className="text-blue-500 hover:underline" onClick={() => onEdit(selectedMarker.data)}>Edit</button>
                             )}
                             {onDelete && (
                                <button className="text-red-500 hover:underline" onClick={() => onDelete(selectedMarker.data)}>Delete</button>
                             )}
                        </div>
                    </div>
                </Popup>
            )}
         </MapGL>
         {/* Mobile UX (round 3) — bottom-sheet record card replaces the
             Popup on small viewports for a native-feeling mobile pattern. */}
         {selectedMarker && isMobile && (
           <div
             className="absolute inset-x-0 bottom-0 z-30 bg-background border-t shadow-lg rounded-t-2xl p-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
             role="dialog"
             aria-label="Location details"
             data-testid="map-mobile-record-sheet"
           >
             <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted" aria-hidden="true" />
             <div className="flex items-start justify-between gap-3">
               <div className="min-w-0 flex-1">
                 <h3 className="text-sm font-semibold truncate">{selectedMarker.title}</h3>
                 {selectedMarker.description && (
                   <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{selectedMarker.description}</p>
                 )}
               </div>
               <button
                 type="button"
                 onClick={() => setSelectedMarkerId(null)}
                 className="text-muted-foreground hover:text-foreground text-lg leading-none px-2"
                 aria-label="Close details"
                 data-testid="map-mobile-record-close"
               >
                 ×
               </button>
             </div>
             <div className="mt-3 flex flex-wrap gap-2 text-xs">
               {onEdit && (
                 <button
                   className="px-3 py-1.5 rounded-md border bg-card hover:bg-accent"
                   onClick={() => onEdit(selectedMarker.data)}
                 >Edit</button>
               )}
               {onDelete && (
                 <button
                   className="px-3 py-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                   onClick={() => onDelete(selectedMarker.data)}
                 >Delete</button>
               )}
             </div>
           </div>
         )}
         {geoError && (
           <div className="absolute top-2 left-14 right-2 z-10 text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
             {geoError}
           </div>
         )}
      </div>
      {navigation.isOverlay && (
        <NavigationOverlay {...navigation} title="Location Details">
          {(record) => (
            <div className="space-y-3">
              {Object.entries(record).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm">{String(value ?? '—')}</span>
                </div>
              ))}
            </div>
          )}
        </NavigationOverlay>
      )}
    </div>
  );
};

export default ObjectMap;
