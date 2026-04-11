'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './AddressLocationPicker.module.css';
import MapCurrentLocationButton from '@/components/MapCurrentLocationButton';
import {
  formatGoogleMapsLoadError,
  getGoogleMapsApiKeyPresent,
  loadGoogleMaps,
  reverseGeocodeLatLng,
} from '@/lib/maps/googleMaps';

type AddressLocationPickerProps = {
  latitude?: number;
  longitude?: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
};

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

type PlacePrediction = {
  placeId: string;
  description: string;
};

/** Fixed centre pin (tip at map centre); pointer-events none so the map stays draggable. */
function MapCenterPin() {
  return (
    <div className={styles.centerPin} aria-hidden>
      <svg
        viewBox="0 0 12 12"
        className={styles.centerPinSvg}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <path
          d="M6,0C3.2385864,0,1,2.2385864,1,5s2.5,5,5,7c2.5-2,5-4.2385864,5-7S8.7614136,0,6,0z M6,7 C4.8954468,7,4,6.1045532,4,5s0.8954468-2,2-2s2,0.8954468,2,2S7.1045532,7,6,7z"
          fill="#0062ff"
        />
      </svg>
    </div>
  );
}

export default function AddressLocationPicker({
  latitude,
  longitude,
  onChange,
}: AddressLocationPickerProps) {
  const hasSelection = typeof latitude === 'number' && typeof longitude === 'number';
  const center = useMemo<[number, number]>(
    () => (hasSelection ? [latitude as number, longitude as number] : DEFAULT_CENTER),
    [hasSelection, latitude, longitude],
  );

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlacePrediction[]>([]);

  /** Only show permission help if GPS failed and user still has no address/map fix. */
  const shouldOpenPermissionHelpOnDeny = useCallback(() => {
    const hasText = searchText.trim().length > 0;
    const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
    return !hasText && !hasCoords;
  }, [searchText, latitude, longitude]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        if (cancelled) return;
        setMapsReady(true);
      } catch (error) {
        if (cancelled) return;
        setMapsError(formatGoogleMapsLoadError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;

    const initialLat = hasSelection ? (latitude as number) : DEFAULT_CENTER[0];
    const initialLng = hasSelection ? (longitude as number) : DEFAULT_CENTER[1];
    const zoom = hasSelection ? 16 : 5;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstanceRef.current = map;

    placesServiceRef.current = new google.maps.places.PlacesService(document.createElement('div'));
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

    map.addListener('dragend', () => {
      const c = map.getCenter();
      if (!c) return;
      const lat = c.lat();
      const lng = c.lng();
      onChangeRef.current({ latitude: lat, longitude: lng });
      void reverseGeocodeLatLng(lat, lng).then((rev) => {
        if (rev) setSearchText(rev);
      });
      setResults([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create map once; use pan effect for prop updates
  }, [mapsReady]);

  useEffect(() => {
    const trimmed = searchText.trim();
    const autocompleteService = autocompleteServiceRef.current;
    if (!trimmed || trimmed.length < 3 || !autocompleteService) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const next = await autocompleteService.getPlacePredictions({
          input: trimmed,
          componentRestrictions: { country: 'in' },
        });
        setResults((next.predictions || []).slice(0, 5).map((item) => ({
          placeId: item.place_id,
          description: item.description,
        })));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const nextCenter = { lat: center[0], lng: center[1] };
    map.panTo(nextCenter);
    if (hasSelection) {
      map.setZoom(16);
    }
  }, [center, hasSelection]);

  const onPickPlace = (placeId: string) => {
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      {
        placeId,
        fields: ['formatted_address', 'geometry'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) return;
        const latValue = place.geometry.location.lat();
        const lngValue = place.geometry.location.lng();
        onChange({ latitude: latValue, longitude: lngValue });
        setSearchText(place.formatted_address || `${latValue.toFixed(6)}, ${lngValue.toFixed(6)}`);
        setResults([]);
      },
    );
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Pin exact location on map</p>
      <p className={styles.helpText}>
        Drag the map so the <strong>blue pin</strong> sits on your doorstep, search above, or use{' '}
        <strong>Use current location</strong>. Coordinates update when you finish dragging.
      </p>
      {!getGoogleMapsApiKeyPresent() ? (
        <p className={styles.searchStatus}>
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY to <code>.env.local</code> (app root) and restart{' '}
          <code>next dev</code>.
        </p>
      ) : null}
      {mapsError ? <p className={styles.searchStatus}>{mapsError}</p> : null}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          className={styles.searchInput}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search location"
        />
        {searching ? <p className={styles.searchStatus}>Searching...</p> : null}
        {results.length > 0 ? (
          <div className={styles.searchResults}>
            {results.map((item) => (
              <button
                key={item.placeId}
                type="button"
                className={styles.searchResultItem}
                onClick={() => onPickPlace(item.placeId)}
              >
                {item.description}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.mapWrap}>
        <MapCurrentLocationButton
          className={styles.mapLocateFloating}
          disabled={!mapsReady || Boolean(mapsError)}
          timeoutMs={6500}
          shouldOpenPermissionHelpOnDeny={shouldOpenPermissionHelpOnDeny}
          onLocated={async (r) => {
            onChange({ latitude: r.latitude, longitude: r.longitude });
            setSearchText(
              r.formattedAddress || `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`,
            );
            setResults([]);
          }}
        />
        <div ref={mapRef} className={styles.map} />
        <MapCenterPin />
      </div>
      <p className={styles.coords}>
        {hasSelection
          ? `Selected: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
          : 'No location selected yet'}
      </p>
    </div>
  );
}
