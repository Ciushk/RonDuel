'use client';

import { useEffect, type RefObject } from 'react';

const contributors = new Map<string, number>();
let pwaToastHeightPx = 0;

function publishBottomStack() {
  if (typeof document === 'undefined') return;
  let max = 0;
  for (const value of contributors.values()) {
    if (value > max) max = value;
  }
  if (max <= 0) {
    document.documentElement.style.removeProperty('--bottom-stack');
  } else {
    document.documentElement.style.setProperty('--bottom-stack', `${Math.ceil(max)}px`);
  }
  if (pwaToastHeightPx <= 0) {
    document.documentElement.style.removeProperty('--pwa-toast-height');
  } else {
    document.documentElement.style.setProperty(
      '--pwa-toast-height',
      `${Math.ceil(pwaToastHeightPx)}px`,
    );
  }
}

export function setBottomStack(id: string, px: number) {
  if (px > 0) contributors.set(id, px);
  else contributors.delete(id);
  publishBottomStack();
}

export function clearBottomStack(id: string) {
  contributors.delete(id);
  publishBottomStack();
}

export function setPwaToastHeight(px: number) {
  pwaToastHeightPx = Math.max(0, px);
  publishBottomStack();
}

/**
 * Publishes the distance from the viewport bottom to the top of a fixed bar
 * so RonBot can sit above the bottom nav and any sticky rank bar.
 */
export function useBottomStack(id: string, ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) {
      clearBottomStack(id);
      return;
    }

    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const fromBottom = Math.max(0, window.innerHeight - rect.top);
      setBottomStack(id, fromBottom);
    };

    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      clearBottomStack(id);
    };
  }, [id, ref, active]);
}
