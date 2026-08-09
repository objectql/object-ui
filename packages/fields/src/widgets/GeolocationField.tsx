import React, { useId } from 'react';
import { Input, Button, Label, EmptyValue } from '@object-ui/components';
import { MapPin, Crosshair } from 'lucide-react';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { toHostGroupProps } from './toHostGroupProps';

/**
 * Geolocation data structure
 */
export interface GeolocationValue {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

/**
 * Geolocation field widget - provides a location picker with coordinates
 * Supports manual entry and browser geolocation API
 */
export function GeolocationField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<GeolocationValue>) {
  const [isLoading, setIsLoading] = React.useState(false);
  const location = value || {};
  // DOM pass-through (objectui#3318): the whitelist spread goes onto the FIRST
  // sub-input (latitude); the composite's validation state goes onto BOTH
  // focusable sub-inputs via `aria-invalid={!!error}`.
  //
  // `id` and `aria-labelledby` are held back and land on the group CONTAINER
  // instead (objectui#3961) — they address the whole field, not the latitude box.
  // The host `id` never reached the DOM before: it was overwritten one line later
  // by `id={subId('latitude')}` (objectui#3343), leaving the form's group label
  // pointing at nothing. And `aria-labelledby` on the latitude input would
  // OVERRIDE its own "Latitude" label with the field name. `aria-describedby` and
  // the rest stay on the first sub-input, where focus can reach them.
  const {
    id: _hostId,
    'aria-labelledby': _hostLabelledBy,
    ...domProps
  } = toDomProps(props);
  // The pair held back above, in the one spelling every group-labelled widget
  // uses for it — and computed HERE, before the readonly early return below,
  // because that return used to drop both keys on the floor: a published label
  // id with no consumer in the document (objectui#3990). See `toHostGroupProps`.
  const hostGroupProps = toHostGroupProps(props);
  // Sub-input ids (objectui#3343): `useId()` prefix + sub-field name — the
  // `groupId` paradigm of RadioField / CheckboxesField. Hardcoded literals
  // ("latitude" / "longitude") collide as soon as a form renders two
  // geolocation fields, and every label's htmlFor then resolves to the
  // FIRST match.
  const groupId = useId();
  const subId = (name: keyof GeolocationValue) => `${groupId}-${name}`;

  const handleFieldChange = (fieldName: keyof GeolocationValue, fieldValue: string) => {
    onChange({
      ...location,
      [fieldName]: fieldValue ? Number(fieldValue) : undefined,
    });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setIsLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error.message);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  const formatLocation = (loc: GeolocationValue): string => {
    if (!loc.latitude || !loc.longitude) return '';
    return `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;
  };

  const openInMaps = () => {
    if (!location.latitude || !location.longitude) return;
    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    window.open(url, '_blank');
  };

  if (readonly) {
    // Readonly the composite collapses to the formatted coordinates (plus the
    // "View on map" link), so THAT row is the surface the host label names
    // (objectui#3990). The `EmptyValue` placeholder sits inside it, so it needs
    // nothing of its own.
    const formatted = formatLocation(location);
    return (
      <div {...hostGroupProps} className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        {formatted ? <span className="text-sm">{formatted}</span> : <EmptyValue />}
        {location.latitude && location.longitude && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={openInMaps}
            className="p-0 h-auto"
          >
            View on map
          </Button>
        )}
      </div>
    );
  }

  return (
    // `role="group"` only when a host actually named this container
    // (objectui#3961); standalone rendering stays exactly as it was. That
    // condition now lives in `toHostGroupProps` so this container and the
    // readonly row above cannot answer differently (objectui#3990).
    <div className="space-y-3" {...hostGroupProps}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={getCurrentLocation}
          disabled={readonly || isLoading}
        >
          <Crosshair className="w-4 h-4 mr-2" />
          {isLoading ? 'Getting location...' : 'Use Current Location'}
        </Button>
        {location.latitude && location.longitude && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={openInMaps}
          >
            <MapPin className="w-4 h-4 mr-2" />
            View on map
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={subId('latitude')} className="text-xs">Latitude</Label>
          <Input
            {...domProps}
            id={subId('latitude')}
            type="number"
            value={location.latitude ?? ''}
            onChange={(e) => handleFieldChange('latitude', e.target.value)}
            placeholder="37.7749"
            disabled={readonly || props.disabled}
            step="any"
            className={props.className}
            aria-invalid={!!error}
          />
        </div>
        
        <div>
          <Label htmlFor={subId('longitude')} className="text-xs">Longitude</Label>
          <Input
            id={subId('longitude')}
            type="number"
            value={location.longitude ?? ''}
            onChange={(e) => handleFieldChange('longitude', e.target.value)}
            placeholder="-122.4194"
            disabled={readonly || props.disabled}
            step="any"
            aria-invalid={!!error}
          />
        </div>
      </div>

      {location.accuracy && (
        <p className="text-xs text-muted-foreground">
          Accuracy: ±{location.accuracy.toFixed(0)}m
        </p>
      )}
    </div>
  );
}
