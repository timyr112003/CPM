'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface EpPhotoEditorProps {
  imageSrc: string;
  onConfirm: (croppedBase64: string) => void;
  onCancel: () => void;
  size?: number;
}

/**
 * Simple circular photo editor — allows the user to move and zoom
 * an image so the subject is well-framed before saving.
 */
export function EpPhotoEditor({ imageSrc, onConfirm, onCancel, size = 256 }: EpPhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, ox: 0, oy: 0 });

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  // Load image to get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Initial scale: fit the smaller dimension
      const fitScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      setScale(fitScale);
    };
    img.src = imageSrc;
  }, [imageSrc, size]);

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = size;
    canvas.width = s;
    canvas.height = s;

    ctx.clearRect(0, 0, s, s);

    // Draw the image
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        img,
        offset.x + (s - img.naturalWidth * scale) / 2,
        offset.y + (s - img.naturalHeight * scale) / 2,
        img.naturalWidth * scale,
        img.naturalHeight * scale
      );
      ctx.restore();

      // Draw circular border
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(128,128,128,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    img.src = imageSrc;
  }, [imageSrc, scale, offset, size]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setOffset({ x: d.ox + dx, y: d.oy + dy });
  };

  const handlePointerUp = () => {
    dragRef.current.dragging = false;
  };

  // Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => {
      const next = prev + (e.deltaY > 0 ? -0.05 : 0.05);
      return Math.max(0.3, Math.min(next, 5));
    });
  };

  // Confirm: crop to canvas content
  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL('image/jpeg', 0.85));
  };

  // Reset
  const handleReset = () => {
    const fitScale = Math.max(size / naturalSize.w, size / naturalSize.h);
    setScale(fitScale);
    setOffset({ x: 0, y: 0 });
  };

  const displaySize = Math.min(size, 240);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Настроить фото</h3>
        <span className="text-xs ep-muted">Колёсико — масштаб</span>
      </div>

      {/* Canvas */}
      <div className="flex justify-center" ref={containerRef}>
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{
            width: displaySize,
            height: displaySize,
            borderRadius: '50%',
            cursor: 'grab',
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 px-2">
        <i className="fa-solid fa-magnifying-glass-minus text-xs ep-muted" />
        <input
          type="range"
          min="0.3"
          max="5"
          step="0.05"
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
          className="flex-1 accent-[var(--ep-accent)]"
        />
        <i className="fa-solid fa-magnifying-glass-plus text-xs ep-muted" />
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button type="button" onClick={handleReset} className="ep-btn-ghost text-xs flex-1">
          <i className="fa-solid fa-arrows-rotate mr-1" />Сбросить
        </button>
        <button type="button" onClick={onCancel} className="ep-btn-ghost text-xs flex-1">Отмена</button>
        <button type="button" onClick={handleConfirm} className="ep-btn-accent text-xs flex-1">
          <i className="fa-solid fa-check mr-1" />Готово
        </button>
      </div>
    </div>
  );
}
