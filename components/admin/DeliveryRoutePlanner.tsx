'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import {
  getGoogleMapsApiKeyPresent,
  getLoadedMapsLibrary,
  formatGoogleMapsLoadError,
  loadGoogleMaps,
  reverseGeocodeLatLng,
} from '@/lib/maps/googleMaps';
import { calculateDistance } from '@/lib/maps/routeOptimization';
import MapCurrentLocationButton from '@/components/MapCurrentLocationButton';
import SwipeToDeliver from '@/components/admin/SwipeToDeliver';
import styles from './DeliveryRoutePlanner.module.css';

type SlotKey = 'morning' | 'evening';

export type DeliveryStop = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  date: string;
  lat: number;
  lng: number;
  deliveryTime: string | null;
  status: string;
  litresPerDay?: number | null;
  productName?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type Props = {
  slot: SlotKey;
  date: string;
  onClose: () => void;
};

const PROXIMITY_METERS = 20;

function slotLabel(slot: SlotKey): string {
  return slot === 'morning' ? 'morning' : 'evening';
}

function formatAddress(s: DeliveryStop): string {
  const parts = [s.street, s.city, s.state, s.postalCode].filter((p) => p && String(p).trim());
  return parts.length > 0 ? parts.join(', ') : 'Address on file';
}

function isPendingStop(s: DeliveryStop): boolean {
  return String(s.status).toLowerCase() === 'pending';
}

function pickNearestStop(origin: { lat: number; lng: number }, list: DeliveryStop[]): DeliveryStop | null {
  if (list.length === 0) return null;
  let best = list[0];
  let bestD = calculateDistance(origin.lat, origin.lng, best.lat, best.lng);
  for (let i = 1; i < list.length; i += 1) {
    const c = list[i];
    const d = calculateDistance(origin.lat, origin.lng, c.lat, c.lng);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Full greedy delivery order from an origin through all stops (for “upcoming” list). */
function greedySequenceFrom(origin: { lat: number; lng: number }, stops: DeliveryStop[]): DeliveryStop[] {
  const pending = [...stops];
  const ordered: DeliveryStop[] = [];
  let cur = origin;
  while (pending.length > 0) {
    const next = pickNearestStop(cur, pending);
    if (!next) break;
    ordered.push(next);
    const idx = pending.findIndex((x) => x.id === next.id);
    if (idx >= 0) pending.splice(idx, 1);
    cur = { lat: next.lat, lng: next.lng };
  }
  return ordered;
}

export default function DeliveryRoutePlanner({ slot, date, onClose }: Props) {
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
  const [errorText, setErrorText] = useState<string>('');
  const [mapsReady, setMapsReady] = useState(false);

  const [routeStarted, setRouteStarted] = useState(false);
  const [flowComplete, setFlowComplete] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [remainingStops, setRemainingStops] = useState<DeliveryStop[]>([]);
  const [currentStop, setCurrentStop] = useState<DeliveryStop | null>(null);
  const [sessionDelivered, setSessionDelivered] = useState<DeliveryStop[]>([]);
  const [marking, setMarking] = useState(false);
  const [queuePopupOpen, setQueuePopupOpen] = useState(false);

  const pendingStops = useMemo(() => stops.filter(isPendingStop), [stops]);
  const totalPendingLitres = useMemo(
    () => pendingStops.reduce((sum, s) => sum + (Number(s.litresPerDay) || 0), 0),
    [pendingStops],
  );

  const nearCurrentStop = useMemo(() => {
    if (!routeStarted || !currentStop || !adminLocation || flowComplete) return false;
    const d = calculateDistance(adminLocation.lat, adminLocation.lng, currentStop.lat, currentStop.lng);
    return d <= PROXIMITY_METERS;
  }, [routeStarted, currentStop, adminLocation, flowComplete]);

  const leftCount = remainingStops.length;

  const upcomingOrdered = useMemo(() => {
    if (!routeOrigin || remainingStops.length === 0) return [];
    return greedySequenceFrom(routeOrigin, remainingStops);
  }, [routeOrigin, remainingStops]);

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
      center: { lat: 20.5937, lng: 78.9629 },
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
  }, [mapsReady]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setAdminLocation(next);
        try {
          const address = await reverseGeocodeLatLng(next.lat, next.lng);
          if (address) setAdminAddress(address);
        } catch {
          /* ignore */
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
  }, []);

  const drawLeg = useCallback(async (origin: { lat: number; lng: number }, dest: DeliveryStop) => {
    if (!mapRef.current || !directionsRendererRef.current) return;
    setErrorText('');
    try {
      const directionsService = new google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(dest.lat, dest.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      });
      directionsRendererRef.current.setDirections(result);
      const b = new google.maps.LatLngBounds();
      b.extend(origin);
      b.extend({ lat: dest.lat, lng: dest.lng });
      mapRef.current.fitBounds(b, 48);
    } catch (error) {
      setErrorText((error as Error)?.message || 'Failed to draw route');
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapsReady) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (flowComplete) return;

    if (adminLocation) {
      const adminIconSize = 56;
      markersRef.current.push(
        new google.maps.Marker({
          map: mapRef.current,
          position: adminLocation,
          title: 'Your location',
          icon: {
            url: '/icons/admin-live-location-marker.svg',
            scaledSize: new google.maps.Size(adminIconSize, adminIconSize),
            anchor: new google.maps.Point(adminIconSize / 2, adminIconSize),
          },
        }),
      );
    }

    if (routeStarted && currentStop) {
      markersRef.current.push(
        new google.maps.Marker({
          map: mapRef.current,
          position: { lat: currentStop.lat, lng: currentStop.lng },
          title: currentStop.userName || currentStop.userEmail || 'Delivery',
          label: '▶',
        }),
      );
    } else if (!routeStarted && pendingStops.length > 0) {
      pendingStops.forEach((stop, index) => {
        markersRef.current.push(
          new google.maps.Marker({
            map: mapRef.current,
            position: { lat: stop.lat, lng: stop.lng },
            title: stop.userName || stop.userEmail || `Stop ${index + 1}`,
            label: `${index + 1}`,
            opacity: 0.85,
          }),
        );
      });
    }
  }, [mapsReady, adminLocation, routeStarted, currentStop, pendingStops, flowComplete]);

  const startOptimizedRoute = async () => {
    if (!adminLocation) {
      setErrorText('Live location is required. Enable GPS or use the locate button.');
      return;
    }
    if (pendingStops.length === 0) {
      setErrorText('No pending deliveries for this slot.');
      return;
    }
    setGenerating(true);
    setErrorText('');
    try {
      const origin = { ...adminLocation };
      const list = [...pendingStops];
      const next = pickNearestStop(origin, list);
      if (!next) {
        setErrorText('No stops to route.');
        return;
      }
      setRouteOrigin(origin);
      setRemainingStops(list);
      setCurrentStop(next);
      setRouteStarted(true);
      await drawLeg(origin, next);
    } catch (error) {
      setErrorText((error as Error)?.message || 'Failed to start route');
    } finally {
      setGenerating(false);
    }
  };

  const onMarkDeliveredSwipe = async () => {
    if (!currentStop || marking) return;
    setMarking(true);
    setErrorText('');
    try {
      await apiClient.post(API_ENDPOINTS.DELIVERY_TRACKING.MARK_DELIVERED, {
        deliveryId: currentStop.id,
        date,
      });
      const done = currentStop;
      setStops((prev) =>
        prev.map((s) => (s.id === done.id ? { ...s, status: 'delivered' } : s)),
      );
      setSessionDelivered((prev) => [...prev, done]);

      const rest = remainingStops.filter((s) => s.id !== done.id);
      if (rest.length === 0) {
        setFlowComplete(true);
        setRouteStarted(false);
        setCurrentStop(null);
        setRemainingStops([]);
        return;
      }

      const newOrigin = { lat: done.lat, lng: done.lng };
      setRouteOrigin(newOrigin);
      setRemainingStops(rest);
      const next = pickNearestStop(newOrigin, rest);
      setCurrentStop(next);
      if (next) {
        await drawLeg(newOrigin, next);
      }
    } catch (e) {
      setErrorText((e as { message?: string })?.message || 'Could not mark delivered');
    } finally {
      setMarking(false);
    }
  };

  if (!getGoogleMapsApiKeyPresent()) {
    return (
      <p className={styles.inlineError}>
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY to .env.local (app root) and restart next dev.
      </p>
    );
  }

  const productLabel = (s: DeliveryStop) => s.productName?.trim() || 'Milk';
  const qtyLabel = (s: DeliveryStop) => {
    const q = Number(s.litresPerDay);
    return Number.isFinite(q) && q > 0 ? q : 1;
  };

  return (
    <div className={styles.shell}>
      <div className={styles.mapStage}>
        {!flowComplete ? (
          <>
            <button
              type="button"
              className={styles.mapBackBtn}
              aria-label="Close"
              onClick={onClose}
            >
              <span aria-hidden="true">←</span>
            </button>
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
            <div ref={mapContainerRef} className={styles.mapFill} />
          </>
        ) : (
          <div className={styles.completeMapPlaceholder}>
            <div className={styles.completeIcon} aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="28" fill="#ecfdf5" stroke="#059669" strokeWidth="2" />
                <path
                  d="M20 33l8 8 16-18"
                  stroke="#059669"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className={styles.completeMapTitle}>
              All items delivered for the {slotLabel(slot)} slot.
            </p>
          </div>
        )}
      </div>

      <div className={styles.bottomSheet}>
        {loading ? <p className={styles.sheetMeta}>Loading delivery points…</p> : null}
        {errorText ? <div className={styles.inlineError}>{errorText}</div> : null}

        {!routeStarted && !flowComplete ? (
          <>
            <p className={styles.sheetTitle}>
              To Deliver:{' '}
              <strong>
                {totalPendingLitres > 0 ? `${totalPendingLitres} L` : `${pendingStops.length} stop(s)`}
              </strong>
            </p>
            <p className={styles.sheetSub}>
              Do you want to start delivering for the {slotLabel(slot)} slot?
            </p>
            <button
              type="button"
              className={styles.sheetPrimaryBtn}
              disabled={generating || loading || pendingStops.length === 0}
              onClick={() => void startOptimizedRoute()}
            >
              {generating ? 'Generating…' : 'Generate Optimized Route'}
            </button>
          </>
        ) : null}

        {routeStarted && currentStop && !flowComplete ? (
          <>
            <div className={styles.sheetRowTop}>
              <div className={styles.sheetNameBlock}>
                <p className={styles.customerName}>{currentStop.userName || currentStop.userEmail || `User ${currentStop.userId}`}</p>
                <p className={styles.sheetSub}>
                  To deliver {qtyLabel(currentStop)} L of {productLabel(currentStop)} at {formatAddress(currentStop)}
                </p>
              </div>
              <button
                type="button"
                className={styles.leftPill}
                onClick={() => setQueuePopupOpen(true)}
              >
                {leftCount} left
              </button>
            </div>
            <SwipeToDeliver
              disabled={!nearCurrentStop || marking}
              label="Mark as deliver"
              onConfirm={() => onMarkDeliveredSwipe()}
            />
            {!nearCurrentStop ? (
              <p className={styles.proximityHint}>
                Move within {PROXIMITY_METERS} m of the pin to enable swipe ({PROXIMITY_METERS} m radius).
              </p>
            ) : null}
          </>
        ) : null}

        {flowComplete ? (
          <>
            <p className={styles.sheetTitle}>All done!</p>
            <p className={styles.sheetSub}>
              You are all set for today&apos;s {slotLabel(slot)} slot.
            </p>
            <button type="button" className={styles.sheetPrimaryBtn} onClick={onClose}>
              Return to deliveries
            </button>
          </>
        ) : null}
      </div>

      {queuePopupOpen ? (
        <div
          className={styles.queueOverlay}
          role="presentation"
          onClick={() => setQueuePopupOpen(false)}
        >
          <div
            className={styles.queuePanel}
            role="dialog"
            aria-modal="true"
            aria-label="Delivery queue"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.queueClose}
              aria-label="Close"
              onClick={() => setQueuePopupOpen(false)}
            >
              ×
            </button>

            <h4 className={styles.queueSectionTitle}>Delivered subscriptions</h4>
            {sessionDelivered.length === 0 ? (
              <p className={styles.queueEmpty}>None yet this run.</p>
            ) : (
              <ul className={styles.queueList}>
                {sessionDelivered.map((s, i) => (
                  <li key={`d-${s.id}`} className={styles.queueItem}>
                    <span className={styles.queueNum}>{i + 1}</span>
                    <div>
                      <div className={styles.queueName}>{s.userName || s.userEmail || `User ${s.userId}`}</div>
                      <div className={styles.queueDetail}>
                        {qtyLabel(s)} L · {productLabel(s)} · {formatAddress(s)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h4 className={styles.queueSectionTitle}>Up-coming subscriptions</h4>
            {upcomingOrdered.length === 0 ? (
              <p className={styles.queueEmpty}>No remaining stops.</p>
            ) : (
              <ul className={styles.queueList}>
                {upcomingOrdered.map((s, i) => (
                  <li key={`u-${s.id}`} className={styles.queueItem}>
                    <span className={styles.queueNum}>{i + 1}</span>
                    <div>
                      <div className={styles.queueName}>{s.userName || s.userEmail || `User ${s.userId}`}</div>
                      <div className={styles.queueDetail}>
                        {qtyLabel(s)} L · {productLabel(s)} · {formatAddress(s)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
