'use client';

import styles from './RatingBadge.module.css';

type RatingBadgeSize = 'sm' | 'md';

export interface RatingBadgeProps {
  rating: number;
  size?: RatingBadgeSize;
  className?: string;
  title?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function colorBucket(rating: number): 'red' | 'orange' | 'lightGreen' | 'darkGreen' {
  // Requested buckets:
  // - 1★ -> red
  // - 3★ -> orange
  // - 4★ -> light green
  // - 4.5★+ -> dark green
  if (rating >= 4.5) return 'darkGreen';
  if (rating >= 4.0) return 'lightGreen';
  if (rating >= 2.0) return 'orange';
  return 'red';
}

export default function RatingBadge({ rating, size = 'sm', className, title }: RatingBadgeProps) {
  const safe = clamp(Number.isFinite(rating) ? rating : 0, 0, 5);
  const display = Math.round(safe * 10) / 10;
  const bucket = colorBucket(display);

  const cls = [
    styles.badge,
    styles[size],
    styles[bucket],
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={cls}
      title={title ?? `${display.toFixed(1)} out of 5`}
      aria-label={`Rated ${display.toFixed(1)} out of 5`}
    >
      {display.toFixed(1)}
      <svg
        className={styles.star}
        viewBox="0 0 16 16"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <polygon points="8 11.43 3.67 14 4.84 9.19 1 5.97 6.05 5.57 8 1 9.95 5.57 15 5.97 11.15 9.19 12.33 14 8 11.43" />
      </svg>
    </span>
  );
}


