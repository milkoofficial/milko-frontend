'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SwipeToDeliver.module.css';

const SWIPE_COMPLETE_RATIO = 0.7;

type Props = {
  disabled: boolean;
  label: string;
  onConfirm: () => void | Promise<void>;
};

export default function SwipeToDeliver({ disabled, label, onConfirm }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const dragXRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);

  const maxDrag = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    const knob = 48;
    return Math.max(0, el.clientWidth - knob - 12);
  }, []);

  useEffect(() => {
    dragXRef.current = dragX;
  }, [dragX]);

  useEffect(() => {
    if (disabled) {
      setDragX(0);
      dragXRef.current = 0;
      setDragging(false);
      isDraggingRef.current = false;
    }
  }, [disabled]);

  const progress = (() => {
    const max = maxDrag();
    return max > 0 ? Math.min(1, dragX / max) : 0;
  })();

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setDragging(true);
    startXRef.current = e.clientX - dragXRef.current;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current || disabled) return;
    const max = maxDrag();
    const x = Math.max(0, Math.min(max, e.clientX - startXRef.current));
    dragXRef.current = x;
    setDragX(x);
  };

  const finishDrag = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current || disabled) return;
    isDraggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const max = maxDrag();
    const lastX = dragXRef.current;
    const p = max > 0 ? lastX / max : 0;
    if (p >= SWIPE_COMPLETE_RATIO) {
      await Promise.resolve(onConfirm());
    }
    dragXRef.current = 0;
    setDragX(0);
  };

  return (
    <div
      ref={trackRef}
      className={`${styles.track} ${disabled ? styles.trackDisabled : ''}`}
      style={{ '--swipe-progress': String(progress) } as React.CSSProperties}
    >
      <div className={styles.trackBg}>
        <span className={styles.trackLabel}>{label}</span>
      </div>
      <div className={styles.fill} style={{ width: `${dragX + 52}px` }} />
      <button
        type="button"
        className={styles.knob}
        disabled={disabled}
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          isDraggingRef.current = false;
          setDragging(false);
          dragXRef.current = 0;
          setDragX(0);
        }}
        aria-label={label}
      />
    </div>
  );
}
