import React, { useEffect, useRef, useState } from 'react';
import {
  A4_HEIGHT,
  A4_WIDTH,
  type A4Document,
  type DocInteractionMode,
  type DocShape,
  type InkStroke,
  type ThemeMode,
} from '../types/document';
import { A4PaperView } from './A4PaperView';

interface DocumentCanvasProps {
  doc: A4Document;
  themeMode: ThemeMode;
  mode: DocInteractionMode;
  isWindowActive: boolean;
  zoom: number;
  panX: number;
  panY: number;
  activeStroke: InkStroke | null;
  activeShape: DocShape | null;
  penPos: { x: number; y: number };
  penColor: string;
  penWidth: number;
  rollDeg: number;
  isErasing: boolean;
  isCursorScrubbing: boolean;
  onSelectLine: (lineIndex: number, charIndex?: number) => void;
  onViewportResize?: (w: number, h: number) => void;
}

const MINIMAP_W = 64;
const MINIMAP_H = Math.round((MINIMAP_W * A4_HEIGHT) / A4_WIDTH);

export const DocumentCanvas: React.FC<DocumentCanvasProps> = React.memo(({
  doc,
  themeMode,
  mode,
  isWindowActive,
  zoom,
  panX,
  panY,
  activeStroke,
  activeShape,
  penPos,
  penColor,
  penWidth,
  rollDeg,
  isErasing,
  isCursorScrubbing,
  onSelectLine,
  onViewportResize,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const paperTransformRef = useRef<HTMLDivElement | null>(null);
  const [viewSize, setViewSize] = useState({ w: 540, h: 360 });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        setViewSize({ w: rect.width, h: rect.height });
        onViewportResize?.(rect.width, rect.height);
      }
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(measure);
      obs.observe(el);
      return () => obs.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [mode, onViewportResize]);

  const baseScale = Math.max(
    0.18,
    Math.min((viewSize.w - 14) / A4_WIDTH, (viewSize.h - 14) / A4_HEIGHT),
  );
  const effectiveScale = baseScale * zoom;
  const displayW = A4_WIDTH * effectiveScale;
  const displayH = A4_HEIGHT * effectiveScale;

  // Compute max pan limits so paper never leaves the viewport completely
  const maxPanX = Math.max(0, (displayW - viewSize.w + 16) * 0.5);
  const maxPanY = Math.max(0, (displayH - viewSize.h + 16) * 0.5);
  const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, panY));

  // Visible region in A4 logical coordinates [0..A4_WIDTH, 0..A4_HEIGHT] for minimap red rect
  const visHalfW = viewSize.w / 2 / effectiveScale;
  const visHalfH = viewSize.h / 2 / effectiveScale;
  const centerA4X = A4_WIDTH * 0.5 - clampedPanX / effectiveScale;
  const centerA4Y = A4_HEIGHT * 0.5 - clampedPanY / effectiveScale;
  const visLeft = Math.max(0, centerA4X - visHalfW);
  const visRight = Math.min(A4_WIDTH, centerA4X + visHalfW);
  const visTop = Math.max(0, centerA4Y - visHalfH);
  const visBottom = Math.min(A4_HEIGHT, centerA4Y + visHalfH);

  const rectLeftPct = (visLeft / A4_WIDTH) * 100;
  const rectTopPct = (visTop / A4_HEIGHT) * 100;
  const rectWidthPct = Math.max(8, ((visRight - visLeft) / A4_WIDTH) * 100);
  const rectHeightPct = Math.max(8, ((visBottom - visTop) / A4_HEIGHT) * 100);

  return (
    <div
      ref={viewportRef}
      id="document-sheet"
      tabIndex={0}
      className={`doc-viewport-stage ${
        mode === 'DRAW' ? 'is-draw-mode' : 'is-write-mode'
      } ${isWindowActive ? 'is-window-active' : 'is-window-inactive'}`}
      aria-label="A4 Document View"
    >
      {/* Scaled & Panned A4 Sheet */}
      <div
        ref={paperTransformRef}
        className="doc-a4-transform-layer"
        style={{
          width: A4_WIDTH,
          height: A4_HEIGHT,
          transform: `translate3d(${clampedPanX}px, ${clampedPanY}px, 0) scale(${effectiveScale})`,
          transformOrigin: 'center center',
        }}
      >
        <A4PaperView
          doc={doc}
          paperTheme={themeMode}
          mode={mode}
          activeStroke={activeStroke}
          activeShape={activeShape}
          penPos={penPos}
          penColor={penColor}
          penWidth={penWidth}
          rollDeg={rollDeg}
          isErasing={isErasing}
          isCursorScrubbing={isCursorScrubbing}
          showCursor={mode === 'WRITE'}
          onSelectLine={onSelectLine}
        />
      </div>

      {/* Top-Right Total Document Minimap with Live Red Viewport Rectangle */}
      <div
        className="doc-minimap-box"
        style={{ width: MINIMAP_W, height: MINIMAP_H }}
        aria-label={`Document minimap, zoom ${zoom.toFixed(1)}x`}
      >
        <div
          className="doc-minimap-scale"
          style={{
            width: A4_WIDTH,
            height: A4_HEIGHT,
            transform: `scale(${MINIMAP_W / A4_WIDTH})`,
            transformOrigin: 'top left',
          }}
        >
          <A4PaperView doc={doc} paperTheme="light" isThumbnail />
        </div>
        <div
          className="doc-minimap-red-rect"
          style={{
            left: `${rectLeftPct}%`,
            top: `${rectTopPct}%`,
            width: `${rectWidthPct}%`,
            height: `${rectHeightPct}%`,
          }}
        />
        <span className="doc-minimap-zoom-tag">{zoom.toFixed(1)}x</span>
      </div>
    </div>
  );
});
