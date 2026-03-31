'use client';

import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import styles from './AddressLocationPicker.module.css';

type AddressLocationPickerProps = {
  latitude?: number;
  longitude?: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
};

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || '22bbfebe8a4f42298625c5968463b93b';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({
  onPick,
}: {
  onPick: (coords: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

function MapViewUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 16, { duration: 0.5 });
  }, [center, map]);
  return null;
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
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ label: string; lat: number; lon: number }>>([]);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (!trimmed || trimmed.length < 3 || !GEOAPIFY_KEY) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(trimmed)}&filter=countrycode:in&format=json&limit=5&apiKey=${GEOAPIFY_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Search failed');
        const data = (await res.json()) as {
          results?: Array<{ formatted?: string; lat?: number; lon?: number }>;
        };
        const next = (data.results || [])
          .filter((r) => typeof r.lat === 'number' && typeof r.lon === 'number')
          .map((r) => ({
            label: r.formatted || `${r.lat}, ${r.lon}`,
            lat: r.lat as number,
            lon: r.lon as number,
          }));
        setResults(next);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Pin exact location on map</p>
      <p className={styles.helpText}>Zoom and tap on map to set marker. This helps delivery partner find you faster.</p>
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
                key={`${item.lat}-${item.lon}-${item.label}`}
                type="button"
                className={styles.searchResultItem}
                onClick={() => {
                  onChange({ latitude: item.lat, longitude: item.lon });
                  setSearchText(item.label);
                  setResults([]);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <MapContainer center={center} zoom={hasSelection ? 16 : 5} className={styles.map} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewUpdater center={center} />
        <MapClickHandler onPick={onChange} />
        {hasSelection ? <Marker position={[latitude as number, longitude as number]} /> : null}
      </MapContainer>
      <p className={styles.coords}>
        {hasSelection
          ? `Selected: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
          : 'No location selected yet'}
      </p>
    </div>
  );
}
