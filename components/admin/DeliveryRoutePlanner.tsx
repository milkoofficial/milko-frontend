'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import {
  getGoogleMapsApiKeyPresent,
  getGoogleMapsEnvSetupHint,
  getLoadedMapsLibrary,
  formatGoogleMapsLoadError,
  loadGoogleMaps,
  reverseGeocodeLatLng,
} from '@/lib/maps/googleMaps';
import { calculateDistance } from '@/lib/maps/routeOptimization';
import LocationPermissionHelpDialog from '@/components/LocationPermissionHelpDialog';
import { mapLocationPinIconDataUrl } from '@/components/icons/MapLocationPinIcon';
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
  addressName?: string | null;
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

const PROXIMITY_METERS = 40;

const DELIVERY_COMPLETE_HOLD_MS = 2000;

const MAP_PIN_PX = 48;

const ROUTE_STROKE_COLOR = '#0062ff';
const ROUTE_STROKE_WEIGHT = 5;

function deliveryMapPinMarkerIcon(): google.maps.Icon {
  return {
    url: mapLocationPinIconDataUrl(MAP_PIN_PX),
    scaledSize: new google.maps.Size(MAP_PIN_PX, MAP_PIN_PX),
    anchor: new google.maps.Point(MAP_PIN_PX / 2, MAP_PIN_PX),
  };
}

function slotLabel(slot: SlotKey): string {
  return slot === 'morning' ? 'morning' : 'evening';
}

/** DB-backed lines only (no geocode); used for queue list + fallback label. */
function formatStopAddressSync(s: DeliveryStop): string {
  const parts = [s.addressName, s.street, s.city, s.state, s.postalCode].filter((p) => p && String(p).trim());
  if (parts.length > 0) return parts.join(', ');
  return `Pin: ${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`;
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
  const adminMarkerRef = useRef<google.maps.Marker | null>(null);
  const deliveryMarkersRef = useRef<google.maps.Marker[]>([]);
  const sheetSlideWrapRef = useRef<HTMLDivElement | null>(null);
  const pendingDeliveryCommitRef = useRef<(() => void) | null>(null);
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
  const [locationPermissionHelpOpen, setLocationPermissionHelpOpen] = useState(false);
  const [sheetExiting, setSheetExiting] = useState(false);
  const [sheetEnterNonce, setSheetEnterNonce] = useState(0);
  const [sheetAddressLine, setSheetAddressLine] = useState('');

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
    if (!currentStop) {
      setSheetAddressLine('');
      return;
    }
    const sync = formatStopAddressSync(currentStop);
    const hasDbLines = [currentStop.addressName, currentStop.street, currentStop.city, currentStop.state, currentStop.postalCode].some(
      (p) => p && String(p).trim(),
    );
    if (hasDbLines) {
      setSheetAddressLine(sync);
      return;
    }
    let cancelled = false;
    setSheetAddressLine(sync);
    (async () => {
      try {
        const geo = await reverseGeocodeLatLng(currentStop.lat, currentStop.lng);
        if (cancelled) return;
        if (geo && geo.trim()) setSheetAddressLine(geo.trim());
      } catch {
        /* keep Pin: line */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentStop?.id,
    currentStop?.lat,
    currentStop?.lng,
    currentStop?.addressName,
    currentStop?.street,
    currentStop?.city,
    currentStop?.state,
    currentStop?.postalCode,
  ]);

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
      gestureHandling: 'greedy',
    });
    mapRef.current = map;
    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: ROUTE_STROKE_COLOR,
        strokeOpacity: 1,
        strokeWeight: ROUTE_STROKE_WEIGHT,
      },
    });
  }, [mapsReady]);

  const updateFromGeolocation = useCallback(async (position: GeolocationPosition, opts?: { focusMap?: boolean }) => {
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
    if (opts?.focusMap && mapRef.current) {
      mapRef.current.panTo(next);
      mapRef.current.setZoom(16);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void updateFromGeolocation(position);
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
  }, [updateFromGeolocation]);

  /** First fix + permission: runs without a tap; denied → help dialog. */
  useEffect(() => {
    if (!mapsReady || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void updateFromGeolocation(pos, { focusMap: true });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED || err.code === 1) {
          setLocationPermissionHelpOpen(true);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }, [mapsReady, updateFromGeolocation]);

  const requestLocationOnUserGesture = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocationPermissionHelpOpen(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void updateFromGeolocation(pos, { focusMap: true });
        setLocationPermissionHelpOpen(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED || err.code === 1) {
          setLocationPermissionHelpOpen(true);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }, [updateFromGeolocation]);

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

  /** Admin live marker: update position only (avoids blink on every GPS tick). */
  useEffect(() => {
    if (!mapRef.current || !mapsReady || flowComplete) {
      if (adminMarkerRef.current) {
        adminMarkerRef.current.setMap(null);
        adminMarkerRef.current = null;
      }
      return;
    }
    if (!adminLocation) return;
    const adminIconSize = 56;
    if (!adminMarkerRef.current) {
      adminMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: adminLocation,
        title: 'Your location',
        optimized: true,
        icon: {
          url: '/icons/admin-live-location-marker.svg',
          scaledSize: new google.maps.Size(adminIconSize, adminIconSize),
          anchor: new google.maps.Point(adminIconSize / 2, adminIconSize),
        },
      });
    } else {
      adminMarkerRef.current.setPosition(adminLocation);
    }
  }, [mapsReady, adminLocation, flowComplete]);

  /** Customer / stop pins: rebuild only when route shape changes (not on admin GPS updates). */
  useEffect(() => {
    if (!mapRef.current || !mapsReady || flowComplete) {
      deliveryMarkersRef.current.forEach((m) => m.setMap(null));
      deliveryMarkersRef.current = [];
      return;
    }

    deliveryMarkersRef.current.forEach((m) => m.setMap(null));
    deliveryMarkersRef.current = [];

    if (routeStarted && currentStop) {
      deliveryMarkersRef.current.push(
        new google.maps.Marker({
          map: mapRef.current,
          position: { lat: currentStop.lat, lng: currentStop.lng },
          title: currentStop.userName || currentStop.userEmail || 'Delivery',
          optimized: true,
          icon: deliveryMapPinMarkerIcon(),
        }),
      );
    } else if (!routeStarted && pendingStops.length > 0) {
      pendingStops.forEach((stop, i) => {
        deliveryMarkersRef.current.push(
          new google.maps.Marker({
            map: mapRef.current,
            position: { lat: stop.lat, lng: stop.lng },
            title: stop.userName || stop.userEmail || `Stop ${i + 1}`,
            optimized: true,
            icon: deliveryMapPinMarkerIcon(),
            opacity: 0.92,
          }),
        );
      });
    }
  }, [mapsReady, routeStarted, currentStop, pendingStops, flowComplete]);

  useEffect(() => {
    return () => {
      if (adminMarkerRef.current) {
        adminMarkerRef.current.setMap(null);
        adminMarkerRef.current = null;
      }
      deliveryMarkersRef.current.forEach((m) => m.setMap(null));
      deliveryMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!sheetExiting) return;
    const el = sheetSlideWrapRef.current;
    const fallback = window.setTimeout(() => {
      const fn = pendingDeliveryCommitRef.current;
      pendingDeliveryCommitRef.current = null;
      fn?.();
      setSheetExiting(false);
      setSheetEnterNonce((n) => n + 1);
    }, 420);
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      window.clearTimeout(fallback);
      const fn = pendingDeliveryCommitRef.current;
      pendingDeliveryCommitRef.current = null;
      fn?.();
      setSheetExiting(false);
      setSheetEnterNonce((n) => n + 1);
    };
    el?.addEventListener('transitionend', onEnd, { once: true });
    return () => {
      window.clearTimeout(fallback);
      el?.removeEventListener('transitionend', onEnd);
    };
  }, [sheetExiting]);

  const startOptimizedRoute = async () => {
    if (!adminLocation) {
      setErrorText('Live location is required. Allow location access when prompted, or use Try again in the location dialog.');
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
      pendingDeliveryCommitRef.current = () => {
        setStops((prev) => prev.map((s) => (s.id === done.id ? { ...s, status: 'delivered' } : s)));
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
          void drawLeg(newOrigin, next);
        }
      };
      await new Promise<void>((resolve) => {
        setTimeout(resolve, DELIVERY_COMPLETE_HOLD_MS);
      });
      setSheetExiting(true);
    } catch (e) {
      setErrorText((e as { message?: string })?.message || 'Could not mark delivered');
    } finally {
      setMarking(false);
    }
  };

  if (!getGoogleMapsApiKeyPresent()) {
    return <p className={styles.inlineError}>{getGoogleMapsEnvSetupHint()}</p>;
  }

  const productLabel = (s: DeliveryStop) => s.productName?.trim() || 'Milk';
  const qtyLabel = (s: DeliveryStop) => {
    const q = Number(s.litresPerDay);
    return Number.isFinite(q) && q > 0 ? q : 1;
  };

  /** Before “Generate optimized route” — basket / area icon */
  const sheetDeliveryHeadlineIcon = (
    <svg
      className={styles.sheetHeadlineIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4.20404 15C3.43827 15.5883 3 16.2714 3 17C3 19.2091 7.02944 21 12 21C16.9706 21 21 19.2091 21 17C21 16.2714 20.5617 15.5883 19.796 15M12 6.5V11.5M9.5 9H14.5M18 9.22222C18 12.6587 15.3137 15.4444 12 17C8.68629 15.4444 6 12.6587 6 9.22222C6 5.78578 8.68629 3 12 3C15.3137 3 18 5.78578 18 9.22222Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  /** After route starts — delivery person silhouette */
  const sheetRouteHeadlineIcon = (
    <svg
      className={styles.sheetHeadlineIconRoute}
      viewBox="-20 0 190 190"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M94.11 109.87L86.11 85.87L84.82 94L91.71 147.42C91.71 147.42 84.18 149.95 82.85 143.29C81.71 137.56 76.12 112.06 76.12 112.06L73.2 111.89C73.2 111.89 68 135.1 66.42 142.72C64.9 150.19 57.15 147.14 57.15 147.14L64.93 91.36L63.85 85.59L56.05 110.44C56.05 110.44 49.05 110.44 51.05 102.36C53.11 94.03 58.25 72.8 58.25 72.8C66.25 64.8 83.78 64.8 91.69 72.8C91.69 72.8 97.5 96.52 99.02 102.8C100.54 109.08 94.11 109.87 94.11 109.87ZM66.82 53.5C66.82 40.88 85.03 43.11 83.62 54.35C82.27 65.17 66.82 66.29 66.82 53.5Z"
        fill="currentColor"
      />
    </svg>
  );

  return (
    <div className={styles.shell}>
      <div className={styles.bottomSheet}>
        {loading ? <p className={styles.sheetMeta}>Loading delivery points…</p> : null}
        {errorText ? <div className={styles.inlineError}>{errorText}</div> : null}

        {!routeStarted && !flowComplete ? (
          <div className={styles.sheetStepBlock}>
            <div className={styles.sheetHeadlineRow}>
              {sheetDeliveryHeadlineIcon}
              <div className={styles.sheetTextGroup}>
                <p className={styles.sheetTitle}>
                  To Deliver:{' '}
                  <strong>
                    {totalPendingLitres > 0 ? `${totalPendingLitres} L` : `${pendingStops.length} stop(s)`}
                  </strong>
                </p>
                <p className={styles.sheetSub}>
                  Do you want to start delivering for the {slotLabel(slot)} slot?
                </p>
              </div>
            </div>
            <button
              type="button"
              className={`${styles.sheetPrimaryBtn} ${styles.sheetPrimaryBtnWithIcon}`}
              disabled={generating || loading || pendingStops.length === 0}
              onClick={() => void startOptimizedRoute()}
            >
              <svg
                className={styles.sheetPrimaryBtnIcon}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M21.3046 4.69335C21.908 3.41959 20.5806 2.09225 19.3069 2.69561L2.83473 10.4982C1.56185 11.1011 1.74664 12.9674 3.11305 13.309L9.17556 14.8247L10.6912 20.8872C11.0328 22.2536 12.8991 22.4384 13.502 21.1655L21.3046 4.69335Z"
                  fill="currentColor"
                />
              </svg>
              {generating ? 'Generating…' : 'Generate Optimized Route'}
            </button>
          </div>
        ) : null}

        {routeStarted && currentStop && !flowComplete ? (
          <div
            ref={sheetSlideWrapRef}
            className={`${styles.sheetSlideWrap} ${sheetExiting ? styles.sheetSlideWrapOut : ''}`}
          >
            <div
              key={`${currentStop.id}-${sheetEnterNonce}`}
              className={sheetEnterNonce > 0 ? styles.sheetSlideInnerEnter : undefined}
            >
              <div className={styles.sheetRowTop}>
                <div className={styles.sheetNameBlock}>
                  <div className={styles.sheetHeadlineRow}>
                    {sheetRouteHeadlineIcon}
                    <div className={styles.sheetTextGroup}>
                      <p className={styles.customerName}>{currentStop.userName || currentStop.userEmail || `User ${currentStop.userId}`}</p>
                      <p className={styles.sheetSub}>
                        To deliver {qtyLabel(currentStop)} L of {productLabel(currentStop)} at {sheetAddressLine || formatStopAddressSync(currentStop)}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.leftPill}
                  onClick={() => setQueuePopupOpen(true)}
                >
                  <svg
                    className={styles.leftPillIcon}
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M42 0a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3v5.295C23.364 15.785 6.5 34.209 6.5 56.5C6.5 80.483 26.017 100 50 100s43.5-19.517 43.5-43.5a43.22 43.22 0 0 0-6.72-23.182l4.238-3.431l1.888 2.332a2 2 0 0 0 2.813.297l3.11-2.518a2 2 0 0 0 .294-2.812L89.055 14.75a2 2 0 0 0-2.813-.297l-3.11 2.518a2 2 0 0 0-.294 2.812l1.889 2.332l-4.22 3.414C73.77 18.891 64.883 14.435 55 13.297V8h3a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H42zm8 20c20.2 0 36.5 16.3 36.5 36.5S70.2 93 50 93S13.5 76.7 13.5 56.5S29.8 20 50 20zm.002 7.443L50 56.5l23.234 17.447a29.056 29.056 0 0 0 2.758-30.433a29.056 29.056 0 0 0-25.99-16.07z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className={styles.leftPillLabel}>
                    {leftCount} left
                  </span>
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
            </div>
          </div>
        ) : null}

        {flowComplete ? (
          <div className={styles.sheetStepBlock}>
            <div className={styles.sheetHeadlineRow}>
              {sheetRouteHeadlineIcon}
              <div className={styles.sheetTextGroup}>
                <p className={styles.sheetTitle}>All done!</p>
                <p className={styles.sheetSub}>You are all set for today&apos;s {slotLabel(slot)} slot.</p>
              </div>
            </div>
            <button type="button" className={styles.sheetPrimaryBtn} onClick={onClose}>
              Return to deliveries
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.mapStage}>
        {!flowComplete ? (
          <>
            <button
              type="button"
              className={styles.mapBackBtn}
              aria-label="Close"
              onClick={onClose}
            >
              <svg
                className={styles.mapBackIcon}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M11.7071 4.29289C12.0976 4.68342 12.0976 5.31658 11.7071 5.70711L6.41421 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H6.41421L11.7071 18.2929C12.0976 18.6834 12.0976 19.3166 11.7071 19.7071C11.3166 20.0976 10.6834 20.0976 10.2929 19.7071L3.29289 12.7071C3.10536 12.5196 3 12.2652 3 12C3 11.7348 3.10536 11.4804 3.29289 11.2929L10.2929 4.29289C10.6834 3.90237 11.3166 3.90237 11.7071 4.29289Z"
                  fill="currentColor"
                />
              </svg>
            </button>
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

      <LocationPermissionHelpDialog
        open={locationPermissionHelpOpen}
        onClose={() => setLocationPermissionHelpOpen(false)}
        onTryAgain={requestLocationOnUserGesture}
        onReloadPage={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
      />

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
                        {qtyLabel(s)} L · {productLabel(s)} · {formatStopAddressSync(s)}
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
                        {qtyLabel(s)} L · {productLabel(s)} · {formatStopAddressSync(s)}
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
