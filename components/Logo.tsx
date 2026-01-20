'use client';

import { useEffect, useState } from 'react';
import { contentApi } from '@/lib/api';

export interface LogoProps {
  /** Class for the text fallback (e.g. "Milko") */
  textClassName?: string;
  /** Class for the image when logo is set */
  imageClassName?: string;
  /** Fallback text when no logo is configured */
  fallbackText?: string;
}

/**
 * Renders the site logo from content (Cloudinary) or fallback text.
 * Fetches /api/content/logo; if metadata.imageUrl exists, shows img with metadata.widthPx.
 */
export default function Logo({ textClassName, imageClassName, fallbackText = 'Milko' }: LogoProps) {
  const [config, setConfig] = useState<{ imageUrl: string; widthPx?: number } | null>(null);

  useEffect(() => {
    contentApi
      .getByType('logo')
      .then((c) => {
        const url = c?.metadata?.imageUrl;
        if (typeof url === 'string' && url) {
          const w = c?.metadata?.widthPx;
          setConfig({ imageUrl: url, widthPx: typeof w === 'number' ? w : 120 });
        }
      })
      .catch(() => setConfig(null));
  }, []);

  if (config?.imageUrl) {
    return (
      <img
        src={config.imageUrl}
        alt="Logo"
        style={{ width: config.widthPx ?? 120, height: 'auto', display: 'block' }}
        className={imageClassName}
      />
    );
  }
  return <span className={textClassName}>{fallbackText}</span>;
}
