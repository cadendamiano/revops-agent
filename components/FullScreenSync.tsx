'use client';
import { useEffect } from 'react';

export function FullScreenSync() {
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onFullScreenChanged) return;
    return api.onFullScreenChanged((isFs: boolean) => {
      document.body.classList.toggle('fullscreen', isFs);
    });
  }, []);
  return null;
}
