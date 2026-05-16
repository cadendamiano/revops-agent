'use client';

import { useRef } from 'react';

export function ResizeHandle({ onDelta }: { onDelta: (px: number) => void }) {
  const startX = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    startX.current = e.clientX;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');

    function onMove(ev: PointerEvent) {
      onDelta(ev.clientX - startX.current);
      startX.current = ev.clientX;
    }
    function onUp() {
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    }
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }

  return <div className="resize-handle" onPointerDown={onPointerDown} />;
}
