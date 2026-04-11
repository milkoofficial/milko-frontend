'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { getGoogleMapsApiKeyPresent, reverseGeocodeLatLng } from '@/lib/maps/googleMaps';
import { getQuickGeolocationPosition } from '@/lib/utils/geolocation';
import LocationPermissionHelpDialog from '@/components/LocationPermissionHelpDialog';
import styles from './MapCurrentLocationButton.module.css';

export type MapLocatedResult = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  formattedAddress: string | null;
};

type Props = {
  onLocated: (r: MapLocatedResult) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  /** Reverse-geocode when Maps API key is configured (default true) */
  withAddress?: boolean;
  /** Geolocation timeout in ms (default 7000) */
  timeoutMs?: number;
};

const locateIcon = (
  <svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function MapCurrentLocationButton({
  onLocated,
  className,
  disabled,
  withAddress = true,
  timeoutMs = 7000,
}: Props) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [permissionHelpOpen, setPermissionHelpOpen] = useState(false);

  const runLocate = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Location is not supported on this device.', 'error');
      return;
    }

    setBusy(true);
    setPermissionHelpOpen(false);
    try {
      const pos = await getQuickGeolocationPosition(timeoutMs);
      const { latitude, longitude, accuracy } = pos.coords;
      const accuracyM = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : null;

      let formattedAddress: string | null = null;
      if (withAddress && getGoogleMapsApiKeyPresent()) {
        try {
          formattedAddress = await reverseGeocodeLatLng(latitude, longitude);
        } catch {
          formattedAddress = null;
        }
      }

      await onLocated({
        latitude,
        longitude,
        accuracyM,
        formattedAddress: formattedAddress?.trim() || null,
      });
    } catch (err: unknown) {
      const geo = err as GeolocationPositionError;
      if (geo && typeof geo.code === 'number') {
        if (geo.code === 1) {
          setPermissionHelpOpen(true);
          return;
        }
        if (geo.code === 2) {
          showToast('Location unavailable. Try outdoors or pick on the map.', 'error');
          return;
        }
        if (geo.code === 3) {
          showToast('Location timed out. Try again.', 'error');
          return;
        }
      }
      showToast('Could not get your location.', 'error');
    } finally {
      setBusy(false);
    }
  }, [onLocated, showToast, timeoutMs, withAddress]);

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${className || ''}`}
        disabled={disabled || busy}
        onClick={runLocate}
        aria-label="Use current location"
      >
        {locateIcon}
        {busy ? 'Locating…' : 'Use current location'}
      </button>

      <LocationPermissionHelpDialog
        open={permissionHelpOpen}
        onClose={() => setPermissionHelpOpen(false)}
        onTryAgain={() => {
          setPermissionHelpOpen(false);
          void runLocate();
        }}
      />
    </>
  );
}
