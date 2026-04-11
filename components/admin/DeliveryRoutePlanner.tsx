'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import {
  getGoogleMapsApiKeyPresent,
  getLoadedMapsLibrary,
  formatGoogleMapsLoadError,
  loadGoogleMaps,
  reverseGeocodeLatLng,
} from '@/lib/maps/googleMaps';
import { calculateDistance, optimizeRoute, type RouteUserPoint } from '@/lib/maps/routeOptimization';
import MapCurrentLocationButton from '@/components/MapCurrentLocationButton';
import styles from './DeliveryRoutePlanner.module.css';

type SlotKey = 'morning' | 'evening';

type DeliveryStop = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  date: string;
  lat: number;
  lng: number;
  deliveryTime: string | null;
  status: 'pending' | 'delivered';
};

type Props = {
  slot: SlotKey;
  date: string;
};

function formatMeters(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

export default function DeliveryRoutePlanner({ slot, date }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [adminLocation, setAdminLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [adminAddress, setAdminAddress] = useState<string>('');
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(0);
  const [routeDurationSec, setRouteDurationSec] = useState(0);
  const [activeStopId, setActiveStopId] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string>('');
  const [mapsReady, setMapsReady] = useState(false);

  const pendingStops = useMemo(() => stops.filter((s) => s.status !== 'delivered'), [stops]);
  const activeStop = useMemo(() => stops.find((s) => s.id === activeStopId) || null, [stops, activeStopId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorText('');
      try {
        await loadGoogleMaps();
        if (cancelled) return;
        setMapsReady(true);
      } catch (error) {
        if (cancelled) return;
        setMapsReady(false);
        setErrorText(formatGoogleMapsLoadError(error));
        setLoading(false);
        return;
      }
      try {
        const deliveryData = await apiClient.get<DeliveryStop[]>(
          `${API_ENDPOINTS.DELIVERY_TRACKING.LIST}?date=${encodeURIComponent(date)}&slot=${slot}`,
        );
        if (cancelled) return;
        setStops(Array.isArray(deliveryData) ? deliveryData : []);
      } catch (error) {
        if (cancelled) return;
        setErrorText((error as { message?: string })?.message || 'Unable to load route data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, slot]);

  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || mapRef.current) return;
    let MapCtor: typeof google.maps.Map;
    try {
      ({ Map: MapCtor } = getLoadedMapsLibrary());
    } catch {
      setErrorText(
        'Google Maps failed to load (check API key, billing, and Maps JavaScript API on the same Cloud project).',
      );
      return;
    }
    if (typeof MapCtor !== 'function') {
      setErrorText(
        'Google Maps failed to load (check API key, billing, and Maps JavaScript API on the same Cloud project).',
      );
      return;
    }
    const map = new MapCtor(mapContainerRef.current, {
      center: adminLocation || { lat: 20.5937, lng: 78.9629 },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;
    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#0c4a6e',
        strokeOpacity: 0.9,
        strokeWeight: 5,
      },
    });
  }, [mapsReady, adminLocation]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setAdminLocation(next);
        const nearest = pendingStops.reduce<{ id: number | null; d: number }>(
          (acc, stop) => {
            const d = calculateDistance(next.lat, next.lng, stop.lat, stop.lng);
            if (d < acc.d) return { id: stop.id, d };
            return acc;
          },
          { id: null, d: Number.POSITIVE_INFINITY },
        );
        setActiveStopId(nearest.d <= 40 ? nearest.id : null);
        try {
          const address = await reverseGeocodeLatLng(next.lat, next.lng);
          if (address) setAdminAddress(address);
        } catch {
          // Ignore transient reverse-geocode errors.
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      },
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [pendingStops]);

  useEffect(() => {
    if (!mapRef.current || !mapsReady) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (adminLocation) {
      const adminIconSize = 56;
      markersRef.current.push(
        new google.maps.Marker({
          map: mapRef.current,
          position: adminLocation,
          title: 'Warehouse / Admin live location',
          icon: {
            url: '/icons/admin-live-location-marker.svg',
            scaledSize: new google.maps.Size(adminIconSize, adminIconSize),
            anchor: new google.maps.Point(adminIconSize / 2, adminIconSize),
          },
        }),
      );
    }

    stops.forEach((stop, index) => {
      markersRef.current.push(
        new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: stop.lat, lng: stop.lng },
          title: stop.userName || stop.userEmail || `Stop ${index + 1}`,
          label: `${index + 1}`,
          opacity: stop.status === 'delivered' ? 0.55 : 1,
        }),
      );
    });
  }, [mapsReady, stops, adminLocation]);

  async function generateOptimizedRoute() {
    if (!adminLocation || !mapRef.current || !directionsRendererRef.current) {
      setErrorText('Live admin location is required to generate route.');
      return;
    }
    if (pendingStops.length === 0) {
      setErrorText('No pending stops for this slot.');
      return;
    }
    setGenerating(true);
    setErrorText('');
    try {
      const optimized = optimizeRoute(
        adminLocation,
        pendingStops.map<RouteUserPoint>((stop) => ({
          id: String(stop.id),
          lat: stop.lat,
          lng: stop.lng,
        })),
      );

      const last = optimized[optimized.length - 1];
      const waypoints = optimized.slice(0, Math.max(optimized.length - 1, 0)).map((point) => ({
        location: new google.maps.LatLng(point.lat, point.lng),
        stopover: true,
      }));

      const directionsService = new google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: new google.maps.LatLng(adminLocation.lat, adminLocation.lng),
        destination: new google.maps.LatLng(last.lat, last.lng),
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      });
      directionsRendererRef.current.setDirections(result);

      const legs = result.routes[0]?.legs || [];
      const totalDistance = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
      const totalDuration = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
      setRouteDistanceMeters(totalDistance);
      setRouteDurationSec(totalDuration);
    } catch (error) {
      setErrorText((error as Error)?.message || 'Failed to generate route');
    } finally {
      setGenerating(false);
    }
  }

  async function onMarkDelivered() {
    if (!activeStop) return;
    await apiClient.post(API_ENDPOINTS.DELIVERY_TRACKING.MARK_DELIVERED, {
      deliveryId: activeStop.id,
      date,
    });
    setStops((prev) => prev.map((s) => (s.id === activeStop.id ? { ...s, status: 'delivered' } : s)));
    setActiveStopId(null);
  }

  if (!getGoogleMapsApiKeyPresent()) {
    return (
      <p className={styles.inlineError}>
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY to .env.local (app root) and restart next dev.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <div>
          <div className={styles.heading}>Route Planner ({slot})</div>
          <div className={styles.meta}>
            {adminAddress || 'Waiting for live location...'}
          </div>
        </div>
        <button type="button" className={styles.generateBtn} onClick={generateOptimizedRoute} disabled={generating || loading}>
          {generating ? 'Generating...' : 'Generate Optimized Route'}
        </button>
      </div>

      {loading ? <div className={styles.meta}>Loading delivery points...</div> : null}
      {errorText ? <div className={styles.inlineError}>{errorText}</div> : null}

      <div className={styles.mapWrap}>
        <MapCurrentLocationButton
          className={styles.mapLocateFloating}
          disabled={!mapsReady || loading}
          timeoutMs={6500}
          onLocated={async (r) => {
            const next = { lat: r.latitude, lng: r.longitude };
            setAdminLocation(next);
            if (mapRef.current) {
              mapRef.current.panTo(next);
              mapRef.current.setZoom(16);
            }
            if (r.formattedAddress) {
              setAdminAddress(r.formattedAddress);
            }
          }}
        />
        <div ref={mapContainerRef} className={styles.map} />
      </div>

      <div className={styles.stats}>
        <span>Total Distance: {routeDistanceMeters > 0 ? formatMeters(routeDistanceMeters) : '—'}</span>
        <span>ETA: {routeDurationSec > 0 ? `${Math.round(routeDurationSec / 60)} min` : '—'}</span>
      </div>

      <div className={styles.stopList}>
        {stops.map((stop, idx) => (
          <div
            key={stop.id}
            className={`${styles.stopItem} ${activeStopId === stop.id ? styles.stopItemActive : ''} ${stop.status === 'delivered' ? styles.stopItemDone : ''}`}
          >
            <span className={styles.stopIndex}>{idx + 1}</span>
            <span>{stop.userName || stop.userEmail || `User ${stop.userId}`}</span>
            <span className={styles.stopStatus}>{stop.status}</span>
          </div>
        ))}
      </div>

      {activeStop ? (
        <button type="button" className={styles.deliveredBtn} onClick={onMarkDelivered}>
          Mark as Delivered
        </button>
      ) : null}
    </div>
  );
}

