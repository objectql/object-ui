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
 * - Works with object/value data providers
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ObjectMapSchema, ObjectMapConfig, DataSource, ViewData } from '@object-ui/types';
import { ObjectMapConfigSchema } from '@object-ui/types/zod';
import { useNavigationOverlay } from '@object-ui/react';
import { NavigationOverlay, cn, useIsMobile } from '@object-ui/components';
import { extractRecords, buildExpandFields, convertSortToQueryParams } from '@object-ui/core';
import MapGL, { NavigationControl, Marker, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  computeMarkerBounds,
  boundsCenter,
  EMPTY_VIEW_ZOOM,
  FIT_MAX_ZOOM,
  FIT_PADDING_PX,
  UNFITTED_CENTER_ZOOM,
} from './camera';

/**
 * Public MapLibre demo style — free, unauthenticated, but not intended for
 * production traffic (rate-limited, no uptime guarantee). Used only when no
 * `style` is configured; a load failure surfaces the banner below rather
 * than failing silently.
 */
const DEFAULT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

export interface ObjectMapProps {
  schema: ObjectMapSchema;
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

/**
 * The FLAT spelling of `ObjectMapConfig`'s keys, as ObjectView / ListView emit it.
 *
 * Both flatteners build an `object-map` schema by spreading `options.map`'s
 * CONTENTS at the top level (`plugin-view/src/ObjectView.tsx` `case 'map'`,
 * `plugin-list/src/ListView.tsx` `case 'map'`) — the product carries these keys
 * and NO `map` key at all. That is an internal transport form, not an authoring
 * surface, so it is declared here in the consumer rather than in
 * `ObjectMapSchema` (maintainer ruling on objectui#5018, 2026-08-17).
 *
 * `locationField` / `titleField` are the two that `ObjectMapSchema` still
 * publishes as well, from before the ruling; the rest exist only here.
 */
type FlatMapConfigKeys = Omit< ObjectMapConfig, 'style' >;

/** What `getMapConfig` may read: the declared schema plus the internal flat form. */
type MapConfigSource = ObjectMapSchema & FlatMapConfigKeys;

/**
 * The flat keys, DERIVED from `ObjectMapConfigSchema` — the same zod object
 * `getMapConfig` validates the `map` block against — rather than hand-listed,
 * so a key added to (or removed from) the declaration reaches the shadow
 * diagnostic below without a second edit (objectui#5177). `style` is excluded
 * because the FLAT form is where its namespace collides with `BaseSchema.style`
 * (see `FlatMapConfigKeys` above and `warnOnTopLevelStyleUrl`) — not because
 * the declaration omits it; `ObjectMapConfigSchema` carries `style` too.
 *
 * `ObjectView` / `ListView` derive their own flatten whitelist from this exact
 * schema (imported from `@object-ui/types/zod`, already a dependency of both —
 * no new coupling to this package's heavier `react-map-gl` / `maplibre-gl`
 * dependencies), so all three sites read one canonical set of keys.
 */
const FLAT_MAP_CONFIG_KEYS = (Object.keys(ObjectMapConfigSchema.shape) as (keyof ObjectMapConfig)[]).filter(
  (key): key is keyof FlatMapConfigKeys => key !== 'style',
);

/**
 * Helper to get data configuration from schema
 */
function getDataConfig(schema: ObjectMapSchema): ViewData | null {
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

const isDev = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.NODE_ENV !== 'production';

/**
 * Warn once per distinct legacy stash, not once per evaluation: `getMapConfig`
 * runs on every render of the map (hover, zoom, search all re-render it), and a
 * warning that floods the console is a warning that gets muted. Mirrors the
 * warn-once discipline of the visibility-predicate diagnostics in
 * `app-shell/src/views/metadata-admin/predicate.ts` (objectui#4049).
 */
const warnedLegacyFilterMapConfigs = new Set<string>();

/**
 * `filter` is the query filter, not a configuration slot — objectui#4034
 * (source thread objectstack#7138).
 *
 * `getMapConfig` used to ALSO read the map's configuration out of
 * `schema.filter.map` (and its `style` half), a shape predating the declared
 * `{ name: 'map', type: 'object' }` input. That read is gone: the block
 * consumes only what it declares. Authoring the config under `filter.map`
 * therefore has no effect, so say so in dev rather than dropping the author's
 * markers without a trace — the map now renders with the DEFAULT field names,
 * which looks exactly like "the data is wrong".
 *
 * Deliberately narrow, to stay off legitimate query filters:
 * - OWN property only. `'map' in someArray` is TRUE via `Array.prototype.map`,
 *   which is precisely how the deleted probe misfired on every array-shaped
 *   filter — including the `and` node a dataSource binding merges
 *   (objectstack#7121). An inherited method is not an authoring mistake.
 * - object-valued only. `filter: { map: 'x' }` reads as a filter on a field
 *   named `map`, not as a stashed MapConfig.
 */
function warnOnLegacyFilterMapConfig(schema: MapConfigSource): void {
  if (!isDev()) return;

  // `filter` is declared as a JSON-Rules array; the legacy stash this probe
  // exists for is an OBJECT, which is why the shape is re-tested at runtime
  // rather than trusted from the declaration.
  const filter: unknown = schema.filter;
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return;
  if (!Object.prototype.hasOwnProperty.call(filter, 'map')) return;

  const legacy = (filter as Record<string, unknown>).map;
  if (!legacy || typeof legacy !== 'object') return;

  let memo: string;
  try {
    memo = `${schema.type ?? 'map'}::${schema.objectName ?? ''}::${JSON.stringify(legacy)}`;
  } catch {
    // Circular author data — still worth one warning, just not a keyed one.
    memo = `${schema.type ?? 'map'}::${schema.objectName ?? ''}::<unserializable>`;
  }
  if (warnedLegacyFilterMapConfigs.has(memo)) return;
  warnedLegacyFilterMapConfigs.add(memo);

  console.warn(
    '[ObjectMap] `filter.map` is no longer read as map configuration, so this map is ' +
      'rendering with the DEFAULT field names (`latitude` / `longitude` / `name`). `filter` is ' +
      'the query filter; the map config belongs under the declared `map` input — move it to ' +
      '`schema.map` (`{ type: \'object-map\', map: { latitudeField, longitudeField, titleField } }`). ' +
      'The old spelling was never documented and could not survive a `dataSource` binding, whose ' +
      'merged filter is an `and` node with no `map` key at all (objectstack#7121). If `map` is ' +
      'genuinely a field you are filtering on, ignore this — the filter itself is passed through ' +
      'untouched. objectui#4034.',
  );
}

/**
 * Warn once per distinct dropped URL, for the same reason the diagnostics
 * around it warn once: this runs on every render of the map.
 */
const warnedTopLevelStyleUrls = new Set<string>();

/**
 * Top-level `style` is `BaseSchema.style` — inline CSS — and is NOT a map style
 * (objectui#5017).
 *
 * `getMapConfig` used to read it FIRST, ahead of both declared spellings, so a
 * map node carrying the base face's own `style: { height: '400px' }` handed that
 * object to MapGL's `mapStyle` prop: no validation, no diagnostic, and a
 * collision `@object-ui/types` had already gone out of its way to avoid — it
 * named the key `mapStyle` (not `style`) for exactly this reason
 * (`objectql.ts`, `ObjectMapSchema.mapStyle`). The consumer contradicted the
 * declaration it was named after; that read is gone.
 *
 * The OBJECT form needs no diagnostic: it is legal base-face authoring, and
 * dropping it is the fix. The STRING form does, because it is the one shape
 * that used to work:
 * - `ObjectView` / `ListView` build an `object-map` schema by spreading the
 *   CONTENTS of `options.map` at the top level (see `FlatMapConfigKeys`), so a
 *   view authored with `map: { style: '<url>' }` arrives here as a top-level
 *   STRING `style` — the flatten crosses the two keys' namespaces. That shape
 *   is not spec-authorable (`@objectstack/spec`'s list-view schemas are strict
 *   and declare no `map` block at all), but it is runtime-reachable, so say
 *   what happened instead of silently painting the demo tiles.
 * - A string is not valid `BaseSchema.style` either (that is a record), so a
 *   string here is unambiguously "the author meant a map style" — there is no
 *   legitimate CSS reading to mistake it for.
 */
function warnOnTopLevelStyleUrl(schema: MapConfigSource): void {
  if (!isDev()) return;

  // Re-tested at runtime rather than trusted from the declaration: the
  // declaration says this key is a CSS record, and the shape this probe exists
  // for is precisely the one that violates it.
  const raw: unknown = schema.style;
  if (typeof raw !== 'string' || raw === '') return;

  const memo = `${schema.type ?? 'map'}::${schema.objectName ?? ''}::${raw}`;
  if (warnedTopLevelStyleUrls.has(memo)) return;
  warnedTopLevelStyleUrls.add(memo);

  console.warn(
    '[ObjectMap] A top-level `style` is NOT read as a map style, so this map is rendering with ' +
      `the DEFAULT public demo tiles and \`${raw}\` was dropped. \`style\` is the base schema's ` +
      'INLINE CSS key (a record of CSS properties), which every node may carry; the map style is ' +
      '`mapStyle` — named that way precisely to avoid this collision. Write `mapStyle: ' +
      `'${raw}'\` at the top level, or \`map: { style: '${raw}' }\` in the declared config block. ` +
      'On a view, note that `options.map` is FLATTENED into the top level, so its `style` lands ' +
      'here as this same top-level key — spell it `map: { mapStyle }` there. objectui#5017.',
  );
}

/**
 * Warn once per distinct shadowing, for the same reason `getMapConfig` warns
 * once per legacy stash: this runs on every render of the map.
 */
const warnedShadowedFlatKeys = new Set<string>();

/**
 * The `map` block won and the internal flat keys alongside it were ignored —
 * say which ones, in dev.
 *
 * Silence here is what the precedence rule costs if it is not diagnosed: two
 * spellings of the same configuration in one schema, one of them inert. The
 * ruling picks the author's block over the flatten product deliberately
 * (maintainer, objectui#5018, 2026-08-17), so the diagnostic names what was
 * dropped rather than leaving the author to discover it from the markers.
 *
 * It cannot fire on the ordinary ObjectView / ListView path: both flatteners
 * emit the flat keys and NO `map` key, so this branch is not even reached for
 * their output. Reaching it means one schema carries both spellings.
 */
function warnOnShadowedFlatMapKeys(schema: MapConfigSource): void {
  if (!isDev()) return;

  const shadowed = FLAT_MAP_CONFIG_KEYS.filter(
    (key) => (schema as Record<string, unknown>)[key] !== undefined,
  );
  if (shadowed.length === 0) return;

  const memo = `${schema.type ?? 'map'}::${schema.objectName ?? ''}::${shadowed.join(',')}`;
  if (warnedShadowedFlatKeys.has(memo)) return;
  warnedShadowedFlatKeys.add(memo);

  console.warn(
    `[ObjectMap] The \`map\` block configures this map, so these top-level keys are ` +
      `IGNORED: ${shadowed.map((k) => `\`${k}\``).join(', ')}. The \`map\` block is the ` +
      'authoring shape; the flat top-level spelling is the internal form ObjectView/ListView ' +
      'produce when they flatten `options.map`, and what the author wrote outranks it. Move ' +
      'anything you still need into `map`, or drop the `map` block. objectui#5018.',
  );
}

/**
 * Helper to get map configuration from schema
 *
 * PRECEDENCE (maintainer ruling on objectui#5018, 2026-08-17): the declared
 * `map` block is checked FIRST and wins outright; the flat top-level spelling
 * is consulted only when no `map` block is present. This is the reverse of the
 * pre-#5018 order, which let the internal flatten product silently shadow an
 * authored block. Safe for the producer path because neither flattener emits a
 * `map` key at all — see `FlatMapConfigKeys`.
 */
function getMapConfig(schema: MapConfigSource): ObjectMapConfig {
  warnOnLegacyFilterMapConfig(schema);
  warnOnTopLevelStyleUrl(schema);

  // A custom style may be set alongside any of the shapes below — read it
  // once so every return path can carry it through.
  //
  // The two DECLARED spellings, and only those: `mapStyle` on the schema
  // (`ObjectMapSchema.mapStyle`) and `style` inside the declared config block
  // (`ObjectMapConfig.style`). The top-level `style` this used to read first is
  // `BaseSchema.style` — inline CSS, a different key with a different meaning —
  // and is no longer consumed here at all (objectui#5017; see
  // `warnOnTopLevelStyleUrl`).
  const style: string | undefined = schema.mapStyle || schema.map?.style;

  // 1. The declared configuration input: `{ name: 'map', type: 'object' }` at
  // the `object-map` / `map` registrations. The author face, and the winner
  // whenever it is present.
  const config: ObjectMapConfig | null = schema.map ?? null;

  if (config) {
    const result = ObjectMapConfigSchema.safeParse(config);
    if (!result.success) {
      console.warn(`[ObjectMap] Invalid map configuration:`, result.error.format());
    }
    warnOnShadowedFlatMapKeys(schema);
    return { ...config, style: config.style || style };
  }

  // 2. The internal flat form — the ObjectView / ListView flatten product.
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

  // Default configuration — field names only. No camera is synthesized here
  // (objectui#4941): this branch is reached precisely when the author declared
  // nothing, and a fabricated `zoom` / `center` is indistinguishable from a
  // declared one at the read site. The old defaults (zoom 10 at the origin)
  // therefore SUPPRESSED the fit for exactly the views that need it most — an
  // unconfigured object list view of continent-wide records first-painted a
  // city-block viewport centred on the set's midpoint, showing no markers at
  // all. With no camera declared, the camera comes from the data.
  return {
    latitudeField: 'latitude',
    longitudeField: 'longitude',
    locationField: 'location',
    titleField: 'name',
    descriptionField: 'description',
    style,
  };
}

/**
 * Extract coordinates from a record based on configuration
 */
function extractCoordinates(record: any, config: ObjectMapConfig): [number, number] | null {
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
        if (schema.data) {
             const passed: unknown = schema.data;
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
          
          const items: any[] = extractRecords(result);
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
    navigation: schema.navigation,
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
    const shouldCluster = enableClustering ?? (schema.enableClustering || filteredMarkers.length > 100);
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

  /**
   * The box the records occupy, along the shortest arc containing them
   * (see `./camera`). `null` when there is nothing to fit.
   */
  const markerBounds = useMemo(
    () => computeMarkerBounds(filteredMarkers.map(m => m.coordinates)),
    [filteredMarkers],
  );

  /**
   * A camera the author declared, read from the documented `map` block. Only a
   * READABLE declaration counts: `MapConfigSchema` already warns about a
   * malformed one, and a shape whose numbers cannot be read is not a camera —
   * letting it suppress the fit would first-paint an empty viewport, which is
   * the defect this whole path exists to prevent (objectui#4941). Nothing is
   * coerced: an unreadable declaration is diagnosed and ignored, never adapted.
   */
  const declaredLatitude = typeof mapConfig.center?.[0] === 'number' ? mapConfig.center[0] : undefined;
  const declaredLongitude = typeof mapConfig.center?.[1] === 'number' ? mapConfig.center[1] : undefined;
  const declaredZoom = typeof mapConfig.zoom === 'number' ? mapConfig.zoom : undefined;
  const hasDeclaredCamera =
    declaredLatitude !== undefined || declaredLongitude !== undefined || declaredZoom !== undefined;

  /**
   * Initial camera. Read once, when `MapGL` mounts — which is also every time
   * the record set changes, because the `loading` gate below unmounts the map
   * for the duration of each fetch. So the one-shot camera always reflects the
   * records currently in hand, and nothing here ever yanks a camera the user
   * has since panned.
   */
  const initialViewState = useMemo(() => {
    // Records, no declared camera: hand MapLibre the box and let it fit at the
    // real container size. `bounds` overrides center/zoom on the constructor.
    if (markerBounds && !hasDeclaredCamera) {
      return {
        bounds: markerBounds,
        fitBoundsOptions: { padding: FIT_PADDING_PX, maxZoom: FIT_MAX_ZOOM },
      };
    }

    // Otherwise the declared halves win and the rest falls back: to the box's
    // centre when there are records, to the world when there are none.
    const fallback = markerBounds ? boundsCenter(markerBounds) : { longitude: 0, latitude: 0 };
    return {
      longitude: declaredLongitude ?? fallback.longitude,
      latitude: declaredLatitude ?? fallback.latitude,
      zoom: declaredZoom ?? (markerBounds ? UNFITTED_CENTER_ZOOM : EMPTY_VIEW_ZOOM),
    };
  }, [markerBounds, hasDeclaredCamera, declaredLongitude, declaredLatitude, declaredZoom]);

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
                                <button type="button" className="text-blue-500 hover:underline" onClick={() => onEdit(selectedMarker.data)}>Edit</button>
                             )}
                             {onDelete && (
                                <button type="button" className="text-red-500 hover:underline" onClick={() => onDelete(selectedMarker.data)}>Delete</button>
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
                 <button type="button"
                   className="px-3 py-1.5 rounded-md border bg-card hover:bg-accent"
                   onClick={() => onEdit(selectedMarker.data)}
                 >Edit</button>
               )}
               {onDelete && (
                 <button type="button"
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
