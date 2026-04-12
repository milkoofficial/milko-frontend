import type { SVGProps } from 'react';

/** Solid teardrop (single subpath) so the marker is fully filled — no inner “hole” showing the map beneath. */
export const MAP_LOCATION_PIN_PATH =
  'M6 1C3.5 1 1.5 3.05 1.5 5.5c0 2.95 4.1 8.35 4.35 8.65.15.2.35.3.55.3s.4-.1.55-.3C7.4 13.85 10.5 8.45 10.5 5.5 10.5 3.05 8.5 1 6 1z';

/** Data URL for `google.maps.Marker` icon (same pin as customer map picker). */
export function mapLocationPinIconDataUrl(pixelSize = 48, fill = '#0062ff'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="${pixelSize}" height="${pixelSize}"><path d="${MAP_LOCATION_PIN_PATH}" fill="${fill}"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export type MapLocationPinIconProps = SVGProps<SVGSVGElement> & {
  /** Default matches customer map picker */
  pinFill?: string;
};

export default function MapLocationPinIcon({
  pinFill = '#0062ff',
  className,
  ...rest
}: MapLocationPinIconProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden
      {...rest}
    >
      <path d={MAP_LOCATION_PIN_PATH} fill={pinFill} />
    </svg>
  );
}
