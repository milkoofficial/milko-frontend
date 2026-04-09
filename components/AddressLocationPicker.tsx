'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './AddressLocationPicker.module.css';
import { getGoogleMapsApiKeyPresent, loadGoogleMaps, reverseGeocodeLatLng } from '@/lib/maps/googleMaps';

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
  const markerRef = useRef<google.maps.Marker | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlacePrediction[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        if (cancelled) return;
        setMapsReady(true);
      } catch (error) {
        if (cancelled) return;
        setMapsError((error as Error)?.message || 'Failed to load Google Maps');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: center[0], lng: center[1] },
      zoom: hasSelection ? 16 : 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstanceRef.current = map;

    markerRef.current = new google.maps.Marker({
      map,
      position: hasSelection ? { lat: latitude as number, lng: longitude as number } : undefined,
      visible: hasSelection,
    });

    placesServiceRef.current = new google.maps.places.PlacesService(document.createElement('div'));
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

    map.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const nextLat = e.latLng.lat();
      const nextLng = e.latLng.lng();
      onChange({ latitude: nextLat, longitude: nextLng });
      const rev = await reverseGeocodeLatLng(nextLat, nextLng);
      if (rev) setSearchText(rev);
      setResults([]);
    });
  }, [mapsReady, center, hasSelection, latitude, longitude, onChange]);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (!trimmed || trimmed.length < 3 || !autocompleteServiceRef.current) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const next = await autocompleteServiceRef.current.getPlacePredictions({
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
    const marker = markerRef.current;
    const nextCenter = { lat: center[0], lng: center[1] };
    map.panTo(nextCenter);
    if (hasSelection) {
      map.setZoom(16);
      if (marker) {
        marker.setPosition({ lat: latitude as number, lng: longitude as number });
        marker.setVisible(true);
      }
    }
  }, [center, hasSelection, latitude, longitude]);

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
      <p className={styles.helpText}>Zoom and tap on map to set marker. This helps delivery partner find you faster.</p>
      {!getGoogleMapsApiKeyPresent() ? (
        <p className={styles.searchStatus}>Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Maps.</p>
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
      <div ref={mapRef} className={styles.map} />
      <p className={styles.coords}>
        {hasSelection
          ? `Selected: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
          : 'No location selected yet'}
      </p>
    </div>
  );
}
