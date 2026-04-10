import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let mapsConfigured = false;
let loaderPromise: Promise<typeof google> | null = null;
let mapsLibrary: google.maps.MapsLibrary | null = null;
const reverseGeocodeCache = new Map<string, string>();

function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}

export function getGoogleMapsApiKeyPresent(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export async function loadGoogleMaps(): Promise<typeof google> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  }

  if (!mapsConfigured) {
    setOptions({
      key: apiKey,
      v: 'weekly',
    });
    mapsConfigured = true;
  }

  if (!loaderPromise) {
    loaderPromise = (async () => {
      const [mapsMod] = await Promise.all([importLibrary('maps'), importLibrary('places')]);
      mapsLibrary = mapsMod;
      return google;
    })();
  }

  return loaderPromise;
}

/** Use after `loadGoogleMaps()` resolves — prefer `Map` / `Marker` from here over `google.maps.*` when possible. */
export function getLoadedMapsLibrary(): google.maps.MapsLibrary {
  if (!mapsLibrary) {
    throw new Error('Call loadGoogleMaps() before getLoadedMapsLibrary()');
  }
  return mapsLibrary;
}

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng);
  if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key) || null;

  const g = await loadGoogleMaps();
  const geocoder = new g.maps.Geocoder();

  const result = await geocoder.geocode({
    location: { lat, lng },
  });

  const address = result.results?.[0]?.formatted_address || null;
  if (address) reverseGeocodeCache.set(key, address);
  return address;
}

