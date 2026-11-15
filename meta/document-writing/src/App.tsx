import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentCanvas } from './components/DocumentCanvas';
import {
  DOC_MODES,
  DRAW_TOP_ITEMS,
  DocumentToolbars,
  WRITE_LIST_OPTIONS,
  WRITE_STYLE_OPTIONS,
  WRITE_TOP_ITEMS,
} from './components/DocumentToolbars';
import { MenuScreen } from './components/MenuScreen';
import type { InputCapabilityReport } from './components/NeuralComposer';
import { useWristbandControls } from './hooks/useWristbandControls';
import { WristSensorController } from './services/wristSensor';
import {
  A4_HEIGHT,
  A4_WIDTH,
  BRUSH_TYPES,
  FONT_SIZES,
  LINE_THICKNESSES,
  SHAPE_TYPES,
  TWENTY_COLORS,
  type A4Document,
  type AppScreen,
  type AppSettings,
  type BlockKind,
  type BrushType,
  type CursorPosition,
  type DocBlock,
  type DocInteractionMode,
  type DocShape,
  type DrawSubmenu,
  type InkPoint,
  type InkStroke,
  type SensorStatus,
  type ShapeType,
  type WriteSubmenu,
} from './types/document';

const DOCS_STORAGE_KEY = 'neuraldoc-meta-a4-v2';
const SETTINGS_STORAGE_KEY = 'neuraldoc-meta-settings-v2';
const PHOTO_DOC_SEEDED_KEY = 'neuraldoc-meta-photo-seeded-demo3';
const PHOTO_BG_URL = `${import.meta.env.BASE_URL}photo-doc-bg.png`;

const MIN_ZOOM = 1.0;
const MAX_ZOOM = 3.5;
const POINTER_SCALE = 360;
const CURSOR_SCRUB_STEP_DEG = 5;
const ERASER_RADIUS = 16;
const MAX_UNDO_HISTORY = 45;

interface DocumentHistorySnapshot {
  blocks: DocBlock[];
  strokes: InkStroke[];
  shapes: DocShape[];
  cursor: CursorPosition;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'transparent',
  wristMappingMode: 'stretched-arm',
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cloneSnapshot(doc: A4Document): DocumentHistorySnapshot {
  return {
    blocks: doc.blocks.map(b => ({ ...b })),
    strokes: doc.strokes.map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p })),
    })),
    shapes: doc.shapes.map(s => ({ ...s })),
    cursor: { ...doc.cursor },
  };
}

function sortDocsWithPinnedFirst(docs: A4Document[]): A4Document[] {
  const pinned = docs.filter(d => d.pinned);
  const unpinned = docs.filter(d => !d.pinned);
  return [...pinned, ...unpinned];
}

function createSeedPhotoDocument(docNumber: number, now = Date.now()): A4Document {
  return {
    id: 'doc-photo-sample',
    docNumber,
    title: `Document ${docNumber} — Photo`,
    pinned: false,
    updatedAt: now,
    backgroundImage: PHOTO_BG_URL,
    cursor: { lineIndex: 0, charIndex: 0 },
    blocks: [
      {
        id: 'blk-photo-1',
        kind: 'p',
        text: '',
        fontSize: 15,
      },
    ],
    strokes: [],
    shapes: [],
  };
}

function createSeedDocuments(): A4Document[] {
  const now = Date.now();
  try {
    localStorage.setItem(PHOTO_DOC_SEEDED_KEY, '1');
  } catch {
    // Ignore storage errors
  }

  const doc1Photo = createSeedPhotoDocument(1, now);

  const doc2FullPage: A4Document = {
    id: 'doc-full-notes',
    docNumber: 2,
    title: 'Document 2 — Architecture Notes',
    pinned: false,
    updatedAt: now - 1000,
    cursor: { lineIndex: 0, charIndex: 0 },
    blocks: [
      {
        id: 'blk-f1',
        kind: 'h1',
        text: 'AirCraft — Neural Wristband & HUD Spec',
        bold: true,
        fontSize: 20,
      },
      {
        id: 'blk-f2',
        kind: 'p',
        text: 'AirCraft bridges Meta Ray-Ban Display glasses with surface EMG wristband telemetry so users can annotate photos and A4 sheets hands-free in any lighting condition.',
        fontSize: 13,
      },
      {
        id: 'blk-f3',
        kind: 'h2',
        text: '1. Core Interaction Pipeline',
        bold: true,
        fontSize: 15,
      },
      {
        id: 'blk-f4',
        kind: 'bullet',
        text: 'Swipe gestures navigate the Explorer Menu, Manual, Settings, and bottom toolbars with deterministic focus.',
        fontSize: 13,
      },
      {
        id: 'blk-f5',
        kind: 'bullet',
        text: '1x Index Hold tracks wrist pitch and yaw at 60fps to paint smooth quadratic Bezier ink strokes or drag geometric shapes.',
        fontSize: 13,
      },
      {
        id: 'blk-f6',
        kind: 'bullet',
        text: '2x Tap Hold separates Zoom (vertical axis) from Panning (horizontal / 3rd axis) so zooming and dragging never conflict.',
        fontSize: 13,
      },
      {
        id: 'blk-f7',
        kind: 'h2',
        text: '2. Photo & Document Sync',
        bold: true,
        fontSize: 15,
      },
      {
        id: 'blk-f8',
        kind: 'p',
        text: 'Captured glasses photos upload directly to the user repository and appear immediately alongside saved A4 notes. Every annotation layer is stored non-destructively in vector SVG coordinates.',
        fontSize: 13,
      },
      {
        id: 'blk-f9',
        kind: 'bullet',
        text: 'Undo history preserves up to 45 snapshots across both Drawing and Writing modes.',
        fontSize: 13,
      },
      {
        id: 'blk-f10',
        kind: 'bullet',
        text: 'Transparent HUD paper mode minimizes visual occlusion over real-world scenes.',
        fontSize: 13,
      },
      {
        id: 'blk-f11',
        kind: 'quote',
        text: 'Target latency: under 16ms per frame from EMG wrist sample to rendered A4 vector stroke.',
        italic: true,
        fontSize: 13,
      },
      {
        id: 'blk-f12',
        kind: 'p',
        text: 'Next milestone: multi-page export, live collaborative cursors, and voice-assisted block formatting during field demos.',
        fontSize: 13,
      },
    ],
    strokes: [],
    shapes: [],
  };

  const doc3BulletsAndDiagrams: A4Document = {
    id: 'doc-bullets-diagrams',
    docNumber: 3,
    title: 'Document 3 — System Flow',
    pinned: false,
    updatedAt: now - 2000,
    cursor: { lineIndex: 0, charIndex: 0 },
    blocks: [
      {
        id: 'blk-bd1',
        kind: 'h2',
        text: 'Demo Flow Checklist',
        bold: true,
        fontSize: 17,
      },
      {
        id: 'blk-bd2',
        kind: 'bullet',
        text: 'Capture photo or open synced workspace sheet',
        fontSize: 14,
      },
      {
        id: 'blk-bd3',
        kind: 'bullet',
        text: 'Annotate key regions with zoom and pen strokes',
        fontSize: 14,
      },
      {
        id: 'blk-bd4',
        kind: 'bullet',
        text: 'Export clean vector overlay for review',
        fontSize: 14,
      },
    ],
    strokes: [],
    shapes: [
      {
        id: 'shp-seed-1',
        kind: 'rectangle',
        x1: 72,
        y1: 455,
        x2: 196,
        y2: 530,
        color: '#06b6d4',
        strokeWidth: 4,
      },
      {
        id: 'shp-seed-2',
        kind: 'arrow',
        x1: 206,
        y1: 492,
        x2: 266,
        y2: 492,
        color: '#f59e0b',
        strokeWidth: 4,
      },
      {
        id: 'shp-seed-3',
        kind: 'circle',
        x1: 278,
        y1: 450,
        x2: 368,
        y2: 536,
        color: '#10b981',
        strokeWidth: 4,
      },
      {
        id: 'shp-seed-4',
        kind: 'arrow',
        x1: 378,
        y1: 492,
        x2: 428,
        y2: 492,
        color: '#f59e0b',
        strokeWidth: 4,
      },
      {
        id: 'shp-seed-5',
        kind: 'triangle',
        x1: 436,
        y1: 450,
        x2: 512,
        y2: 534,
        color: '#a855f7',
        strokeWidth: 4,
      },
    ],
  };

  const doc4JunctionBullets: A4Document = {
    id: 'doc-junction-bullets',
    docNumber: 4,
    title: 'Document 4 — Junction',
    pinned: false,
    updatedAt: now - 3000,
    cursor: { lineIndex: 0, charIndex: 0 },
    blocks: [
      {
        id: 'blk-j1',
        kind: 'bullet',
        text: 'Breakfast is at 9am',
        fontSize: 16,
      },
      {
        id: 'blk-j2',
        kind: 'bullet',
        text: 'Main Challenge submission is until 10am',
        fontSize: 16,
      },
    ],
    strokes: [],
    shapes: [],
  };

  return [doc1Photo, doc2FullPage, doc3BulletsAndDiagrams, doc4JunctionBullets];
}

function createEmptyDocument(docNumber: number): A4Document {
  return {
    id: makeId('doc'),
    docNumber,
    title: `Document ${docNumber}`,
    pinned: false,
    updatedAt: Date.now(),
    cursor: { lineIndex: 0, charIndex: 0 },
    blocks: [
      {
        id: makeId('blk'),
        kind: 'p',
        text: '',
        fontSize: 15,
      },
    ],
    strokes: [],
    shapes: [],
  };
}

function loadSavedDocuments(): A4Document[] {
  try {
    if (localStorage.getItem(PHOTO_DOC_SEEDED_KEY) !== '1') {
      return createSeedDocuments();
    }
    const raw = localStorage.getItem(DOCS_STORAGE_KEY);
    if (!raw) return createSeedDocuments();
    const parsed = JSON.parse(raw) as A4Document[];
    if (!Array.isArray(parsed) || parsed.length === 0) return createSeedDocuments();
    const valid = parsed.filter(
      d =>
        d &&
        typeof d.id === 'string' &&
        typeof d.docNumber === 'number' &&
        Array.isArray(d.blocks) &&
        Array.isArray(d.strokes) &&
        Array.isArray(d.shapes),
    );
    if (valid.length === 0) return createSeedDocuments();

    const normalized = valid.map(d =>
      d.id === 'doc-photo-sample' ||
      (typeof d.backgroundImage === 'string' && d.backgroundImage.length > 0)
        ? { ...d, backgroundImage: PHOTO_BG_URL }
        : d,
    );

    return sortDocsWithPinnedFirst(normalized);
  } catch {
    return createSeedDocuments();
  }
}

function loadSavedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      themeMode: parsed.themeMode === 'light' ? 'light' : 'transparent',
      wristMappingMode:
        parsed.wristMappingMode === 'horizontal-surface'
          ? 'horizontal-surface'
          : 'stretched-arm',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function clampA4Point(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(4, Math.min(A4_WIDTH - 4, x)),
    y: Math.max(4, Math.min(A4_HEIGHT - 4, y)),
  };
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segmentsDistance(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number,
): number {
  return Math.min(
    distPointToSegment(a1x, a1y, b1x, b1y, b2x, b2y),
    distPointToSegment(a2x, a2y, b1x, b1y, b2x, b2y),
    distPointToSegment(b1x, b1y, a1x, a1y, a2x, a2y),
    distPointToSegment(b2x, b2y, a1x, a1y, a2x, a2y),
  );
}

function strokeTouchesEraser(
  stroke: InkStroke,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  radius: number,
): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  const hitRadius = radius + stroke.baseWidth * 0.6;
  if (pts.length === 1) {
    return distPointToSegment(pts[0].x, pts[0].y, p0.x, p0.y, p1.x, p1.y) <= hitRadius;
  }
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    if (segmentsDistance(p0.x, p0.y, p1.x, p1.y, a.x, a.y, b.x, b.y) <= hitRadius) {
      return true;
    }
  }
  return false;
}

function shapeTouchesEraser(
  shape: DocShape,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  radius: number,
): boolean {
  const hitRadius = radius + shape.strokeWidth * 0.6;
  const minX = Math.min(shape.x1, shape.x2);
  const maxX = Math.max(shape.x1, shape.x2);
  const minY = Math.min(shape.y1, shape.y2);
  const maxY = Math.max(shape.y1, shape.y2);

  if (shape.kind === 'arrow') {
    return (
      segmentsDistance(p0.x, p0.y, p1.x, p1.y, shape.x1, shape.y1, shape.x2, shape.y2) <=
      hitRadius + 8
    );
  }

  if (shape.kind === 'circle') {
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const rx = Math.max(4, (maxX - minX) * 0.5);
    const ry = Math.max(4, (maxY - minY) * 0.5);
    const midX = (p0.x + p1.x) * 0.5;
    const midY = (p0.y + p1.y) * 0.5;
    const checks = [p0, p1, { x: midX, y: midY }];
    return checks.some(pt => {
      const norm = Math.hypot((pt.x - cx) / rx, (pt.y - cy) / ry);
      const radialDist = Math.abs(norm - 1) * Math.min(rx, ry);
      return radialDist <= hitRadius;
    });
  }

  const edges: Array<[number, number, number, number]> =
    shape.kind === 'rectangle'
      ? [
          [minX, minY, maxX, minY],
          [maxX, minY, maxX, maxY],
          [maxX, maxY, minX, maxY],
          [minX, maxY, minX, minY],
        ]
      : [
          [(minX + maxX) * 0.5, minY, maxX, maxY],
          [maxX, maxY, minX, maxY],
          [minX, maxY, (minX + maxX) * 0.5, minY],
        ];

  return edges.some(
    ([ax, ay, bx, by]) =>
      segmentsDistance(p0.x, p0.y, p1.x, p1.y, ax, ay, bx, by) <= hitRadius,
  );
}

function getPanBoundsForZoom(
  zoom: number,
  viewSize: { w: number; h: number },
): { maxPanX: number; maxPanY: number } {
  const viewW = viewSize.w > 10 ? viewSize.w : 540;
  const viewH = viewSize.h > 10 ? viewSize.h : 360;
  const baseScale = Math.max(
    0.18,
    Math.min((viewW - 14) / A4_WIDTH, (viewH - 14) / A4_HEIGHT),
  );
  const effectiveScale = baseScale * zoom;
  return {
    maxPanX: Math.max(0, (A4_WIDTH * effectiveScale - viewW + 16) * 0.5),
    maxPanY: Math.max(0, (A4_HEIGHT * effectiveScale - viewH + 16) * 0.5),
  };
}

function clampPanToZoom(
  panX: number,
  panY: number,
  zoom: number,
  viewSize: { w: number; h: number },
): { panX: number; panY: number } {
  const { maxPanX, maxPanY } = getPanBoundsForZoom(zoom, viewSize);
  return {
    panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, panY)),
  };
}

function createStrokeObject(
  point: { x: number; y: number },
  color: string,
  fillColor: string,
  baseWidth: number,
  brushType: BrushType,
): InkStroke {
  return {
    id: makeId('stk'),
    color,
    fillColor,
    baseWidth,
    brushType,
    points: [{ x: point.x, y: point.y, width: baseWidth }],
  };
}

function appendStrokePoint(
  prev: InkStroke,
  rawPoint: { x: number; y: number },
): InkStroke {
  const last = prev.points[prev.points.length - 1];
  const minDist = prev.brushType === 'spray' ? 1.5 : 2.2;
  if (last && Math.hypot(rawPoint.x - last.x, rawPoint.y - last.y) < minDist) {
    return prev;
  }
  return {
    ...prev,
    points: [...prev.points, { x: rawPoint.x, y: rawPoint.y, width: prev.baseWidth }],
  };
}

function readInputCapabilityBaseline(emgWristStatus: string): InputCapabilityReport {
  const win = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  const activeTag = document.activeElement
    ? document.activeElement.tagName.toLowerCase()
    : 'none';
  return {
    emgWristStatus,
    activeElementTag: activeTag,
    hasInputEvents: typeof InputEvent !== 'undefined',
    hasCompositionEvents: typeof CompositionEvent !== 'undefined',
    hasVirtualKeyboard: 'virtualKeyboard' in navigator,
    hasSpeechRecognition: Boolean(win.SpeechRecognition || win.webkitSpeechRecognition),
    lastRawEvents: [],
  };
}

const DEMO_PINK_INK = '#ff2ec4';

const DEMO_HANDWRITING_LINES = [
  'Hey Dad, look at this amazing main stage',
  'background, I told you junction is going',
  'to be awesome. Best regards, Jeremias',
] as const;

interface HandwritingGlyphDef {
  advance: number;
  strokes: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
}

// Single- and multi-stroke cursive-print glyphs normalized on x:[0..1], y:[0..1] (baseline ~0.96, x-height ~0.42).
const HANDWRITING_GLYPHS: Record<string, HandwritingGlyphDef> = {
  H: {
    advance: 1.0,
    strokes: [
      [
        [0.18, 0.05],
        [0.15, 0.35],
        [0.13, 0.66],
        [0.11, 0.96],
      ],
      [
        [0.82, 0.05],
        [0.79, 0.35],
        [0.77, 0.66],
        [0.75, 0.96],
      ],
      [
        [0.13, 0.51],
        [0.46, 0.49],
        [0.79, 0.48],
      ],
    ],
  },
  D: {
    advance: 1.0,
    strokes: [
      [
        [0.18, 0.06],
        [0.16, 0.35],
        [0.14, 0.65],
        [0.13, 0.95],
      ],
      [
        [0.14, 0.08],
        [0.46, 0.05],
        [0.76, 0.14],
        [0.90, 0.36],
        [0.90, 0.62],
        [0.76, 0.84],
        [0.44, 0.95],
        [0.13, 0.95],
      ],
    ],
  },
  I: {
    advance: 0.62,
    strokes: [
      [
        [0.24, 0.06],
        [0.52, 0.05],
        [0.78, 0.05],
      ],
      [
        [0.52, 0.06],
        [0.49, 0.36],
        [0.47, 0.66],
        [0.45, 0.95],
      ],
      [
        [0.18, 0.96],
        [0.46, 0.95],
        [0.74, 0.95],
      ],
    ],
  },
  B: {
    advance: 1.0,
    strokes: [
      [
        [0.18, 0.06],
        [0.16, 0.36],
        [0.14, 0.66],
        [0.13, 0.96],
      ],
      [
        [0.17, 0.08],
        [0.54, 0.05],
        [0.78, 0.14],
        [0.78, 0.32],
        [0.56, 0.45],
        [0.22, 0.48],
        [0.24, 0.49],
        [0.62, 0.51],
        [0.86, 0.64],
        [0.84, 0.84],
        [0.54, 0.95],
        [0.13, 0.95],
      ],
    ],
  },
  J: {
    advance: 0.85,
    strokes: [
      [
        [0.28, 0.07],
        [0.56, 0.05],
        [0.84, 0.05],
      ],
      [
        [0.65, 0.06],
        [0.62, 0.38],
        [0.58, 0.68],
        [0.50, 0.89],
        [0.32, 0.97],
        [0.15, 0.91],
        [0.10, 0.78],
      ],
    ],
  },
  a: {
    advance: 1.0,
    strokes: [
      [
        [0.78, 0.52],
        [0.58, 0.41],
        [0.30, 0.46],
        [0.13, 0.64],
        [0.15, 0.86],
        [0.36, 0.96],
        [0.62, 0.86],
        [0.78, 0.55],
        [0.78, 0.53],
        [0.76, 0.78],
        [0.78, 0.94],
        [0.92, 0.92],
      ],
    ],
  },
  b: {
    advance: 1.0,
    strokes: [
      [
        [0.20, 0.04],
        [0.18, 0.34],
        [0.16, 0.66],
        [0.14, 0.95],
        [0.16, 0.95],
        [0.44, 0.96],
        [0.72, 0.89],
        [0.84, 0.68],
        [0.76, 0.48],
        [0.50, 0.42],
        [0.26, 0.52],
        [0.16, 0.70],
      ],
    ],
  },
  c: {
    advance: 0.92,
    strokes: [
      [
        [0.82, 0.52],
        [0.60, 0.42],
        [0.32, 0.46],
        [0.14, 0.66],
        [0.18, 0.88],
        [0.44, 0.96],
        [0.74, 0.92],
        [0.90, 0.84],
      ],
    ],
  },
  d: {
    advance: 1.0,
    strokes: [
      [
        [0.76, 0.55],
        [0.54, 0.42],
        [0.28, 0.48],
        [0.12, 0.68],
        [0.18, 0.90],
        [0.44, 0.96],
        [0.68, 0.82],
        [0.80, 0.46],
        [0.83, 0.06],
        [0.83, 0.04],
        [0.80, 0.48],
        [0.78, 0.86],
        [0.89, 0.95],
      ],
    ],
  },
  e: {
    advance: 0.95,
    strokes: [
      [
        [0.16, 0.70],
        [0.54, 0.69],
        [0.82, 0.60],
        [0.76, 0.44],
        [0.48, 0.41],
        [0.22, 0.50],
        [0.13, 0.74],
        [0.28, 0.93],
        [0.60, 0.96],
        [0.86, 0.87],
      ],
    ],
  },
  g: {
    advance: 1.0,
    strokes: [
      [
        [0.78, 0.54],
        [0.54, 0.42],
        [0.26, 0.48],
        [0.12, 0.68],
        [0.20, 0.89],
        [0.48, 0.94],
        [0.72, 0.80],
        [0.82, 0.48],
        [0.81, 0.46],
        [0.78, 0.88],
        [0.72, 1.16],
        [0.50, 1.29],
        [0.24, 1.24],
        [0.16, 1.12],
      ],
    ],
  },
  h: {
    advance: 1.0,
    strokes: [
      [
        [0.20, 0.04],
        [0.18, 0.34],
        [0.16, 0.66],
        [0.14, 0.96],
        [0.16, 0.92],
        [0.26, 0.62],
        [0.46, 0.44],
        [0.70, 0.46],
        [0.78, 0.66],
        [0.78, 0.88],
        [0.89, 0.95],
      ],
    ],
  },
  i: {
    advance: 0.58,
    strokes: [
      [
        [0.48, 0.45],
        [0.47, 0.70],
        [0.46, 0.92],
        [0.62, 0.95],
      ],
      [
        [0.49, 0.21],
        [0.52, 0.24],
      ],
    ],
  },
  j: {
    advance: 0.62,
    strokes: [
      [
        [0.58, 0.45],
        [0.55, 0.78],
        [0.50, 1.08],
        [0.42, 1.24],
        [0.24, 1.29],
        [0.10, 1.18],
      ],
      [
        [0.59, 0.20],
        [0.62, 0.23],
      ],
    ],
  },
  k: {
    advance: 0.95,
    strokes: [
      [
        [0.20, 0.04],
        [0.18, 0.34],
        [0.16, 0.66],
        [0.14, 0.96],
      ],
      [
        [0.78, 0.44],
        [0.48, 0.60],
        [0.22, 0.71],
        [0.22, 0.71],
        [0.54, 0.82],
        [0.84, 0.96],
      ],
    ],
  },
  l: {
    advance: 0.58,
    strokes: [
      [
        [0.47, 0.04],
        [0.45, 0.34],
        [0.44, 0.64],
        [0.45, 0.90],
        [0.64, 0.95],
      ],
    ],
  },
  m: {
    advance: 1.22,
    strokes: [
      [
        [0.10, 0.46],
        [0.10, 0.72],
        [0.10, 0.95],
        [0.16, 0.60],
        [0.32, 0.44],
        [0.46, 0.54],
        [0.48, 0.94],
        [0.54, 0.60],
        [0.70, 0.44],
        [0.84, 0.54],
        [0.86, 0.88],
        [0.95, 0.95],
      ],
    ],
  },
  n: {
    advance: 1.0,
    strokes: [
      [
        [0.16, 0.46],
        [0.15, 0.72],
        [0.14, 0.95],
        [0.22, 0.62],
        [0.46, 0.44],
        [0.70, 0.46],
        [0.78, 0.66],
        [0.78, 0.90],
        [0.90, 0.95],
      ],
    ],
  },
  o: {
    advance: 0.96,
    strokes: [
      [
        [0.72, 0.49],
        [0.46, 0.42],
        [0.22, 0.50],
        [0.13, 0.72],
        [0.24, 0.92],
        [0.52, 0.96],
        [0.78, 0.86],
        [0.86, 0.64],
        [0.72, 0.48],
      ],
    ],
  },
  p: {
    advance: 1.0,
    strokes: [
      [
        [0.18, 0.45],
        [0.16, 0.78],
        [0.14, 1.08],
        [0.12, 1.29],
      ],
      [
        [0.17, 0.52],
        [0.38, 0.42],
        [0.68, 0.44],
        [0.84, 0.62],
        [0.78, 0.86],
        [0.50, 0.96],
        [0.24, 0.92],
        [0.16, 0.80],
      ],
    ],
  },
  r: {
    advance: 0.8,
    strokes: [
      [
        [0.22, 0.46],
        [0.21, 0.72],
        [0.20, 0.96],
        [0.28, 0.64],
        [0.50, 0.44],
        [0.76, 0.46],
      ],
    ],
  },
  s: {
    advance: 0.92,
    strokes: [
      [
        [0.80, 0.50],
        [0.58, 0.41],
        [0.30, 0.44],
        [0.20, 0.56],
        [0.44, 0.68],
        [0.74, 0.76],
        [0.80, 0.89],
        [0.56, 0.96],
        [0.26, 0.94],
        [0.14, 0.86],
      ],
    ],
  },
  t: {
    advance: 0.72,
    strokes: [
      [
        [0.46, 0.14],
        [0.45, 0.46],
        [0.44, 0.76],
        [0.46, 0.92],
        [0.68, 0.95],
      ],
      [
        [0.20, 0.44],
        [0.48, 0.43],
        [0.76, 0.42],
      ],
    ],
  },
  u: {
    advance: 1.0,
    strokes: [
      [
        [0.18, 0.45],
        [0.17, 0.74],
        [0.26, 0.93],
        [0.46, 0.96],
        [0.66, 0.84],
        [0.78, 0.56],
        [0.80, 0.46],
        [0.78, 0.82],
        [0.88, 0.95],
      ],
    ],
  },
  v: {
    advance: 0.94,
    strokes: [
      [
        [0.12, 0.45],
        [0.26, 0.72],
        [0.44, 0.96],
        [0.46, 0.96],
        [0.64, 0.72],
        [0.84, 0.45],
      ],
    ],
  },
  w: {
    advance: 1.22,
    strokes: [
      [
        [0.08, 0.45],
        [0.18, 0.74],
        [0.24, 0.95],
        [0.38, 0.72],
        [0.48, 0.54],
        [0.49, 0.54],
        [0.60, 0.76],
        [0.72, 0.95],
        [0.84, 0.72],
        [0.94, 0.45],
      ],
    ],
  },
  y: {
    advance: 0.98,
    strokes: [
      [
        [0.16, 0.46],
        [0.24, 0.76],
        [0.38, 0.93],
        [0.58, 0.86],
        [0.76, 0.56],
        [0.80, 0.46],
        [0.72, 0.84],
        [0.60, 1.16],
        [0.40, 1.29],
        [0.18, 1.24],
      ],
    ],
  },
  z: {
    advance: 0.92,
    strokes: [
      [
        [0.18, 0.46],
        [0.50, 0.45],
        [0.78, 0.45],
        [0.78, 0.46],
        [0.48, 0.70],
        [0.18, 0.94],
        [0.18, 0.95],
        [0.52, 0.95],
        [0.84, 0.94],
      ],
    ],
  },
  ',': {
    advance: 0.55,
    strokes: [
      [
        [0.50, 0.86],
        [0.52, 0.96],
        [0.42, 1.12],
        [0.28, 1.20],
      ],
    ],
  },
  '.': {
    advance: 0.55,
    strokes: [
      [
        [0.46, 0.91],
        [0.51, 0.94],
      ],
    ],
  },
  '!': {
    advance: 0.55,
    strokes: [
      [
        [0.52, 0.08],
        [0.49, 0.36],
        [0.46, 0.64],
        [0.44, 0.74],
      ],
      [
        [0.43, 0.91],
        [0.47, 0.95],
      ],
    ],
  },
};

function resampleHandwritingPoints(points: InkPoint[], stepPx = 1.8): InkPoint[] {
  if (points.length <= 1) return points;
  const out: InkPoint[] = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / stepPx));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        width: a.width,
      });
    }
  }
  return out;
}

function buildHandwritingLineStrokes(
  lineText: string,
  opts: {
    idPrefix: string;
    startX: number;
    baseY: number;
    glyphW: number;
    glyphH: number;
    unitAdvance: number;
    color: string;
    baseWidth: number;
  },
): InkStroke[] {
  const result: InkStroke[] = [];
  let strokeCounter = 0;
  let cursorX = opts.startX;

  for (let i = 0; i < lineText.length; i += 1) {
    const ch = lineText[i];
    if (ch === ' ') {
      cursorX += opts.unitAdvance * 0.58;
      continue;
    }
    const glyph = HANDWRITING_GLYPHS[ch];
    if (!glyph) {
      cursorX += opts.unitAdvance * 0.7;
      continue;
    }

    const baselineJitter = Math.sin(i * 1.9) * 0.45;
    glyph.strokes.forEach(normStroke => {
      const rawPoints: InkPoint[] = normStroke.map(([nx, ny]) => ({
        x: cursorX + nx * opts.glyphW + (0.96 - ny) * 1.25,
        y: opts.baseY + baselineJitter + ny * opts.glyphH,
        width: opts.baseWidth,
      }));
      const points = resampleHandwritingPoints(rawPoints);
      strokeCounter += 1;
      result.push({
        id: `${opts.idPrefix}-${strokeCounter}`,
        color: opts.color,
        baseWidth: opts.baseWidth,
        brushType: 'brush',
        points,
      });
    });

    cursorX += glyph.advance * opts.unitAdvance;
  }

  return result;
}

function buildDemoWaveStrokes(): InkStroke[] {
  const rawPts: InkPoint[] = [];
  const startX = 115;
  const endX = 445;
  const centerY = 305;
  const amp = 34;
  const cycles = 2.6;
  const steps = 110;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    rawPts.push({
      x: startX + (endX - startX) * t,
      y: centerY - Math.sin(t * Math.PI * 2 * cycles) * amp,
      width: 4.5,
    });
  }
  return [
    {
      id: 'demo3-wave-1',
      color: '#06b6d4',
      baseWidth: 4.5,
      brushType: 'pen',
      points: resampleHandwritingPoints(rawPts, 2.2),
    },
  ];
}

function buildDemoArrowStrokes(): InkStroke[] {
  // Points left-upward toward the 2nd Junction bullet ("Main Challenge submission is until 10am")
  const shaftRaw: InkPoint[] = [
    { x: 428, y: 122, width: 3.2 },
    { x: 412, y: 118, width: 3.2 },
    { x: 396, y: 113, width: 3.2 },
    { x: 382, y: 109, width: 3.2 },
  ];
  const headRaw: InkPoint[] = [
    { x: 395, y: 103, width: 3.2 },
    { x: 382, y: 109, width: 3.2 },
    { x: 392, y: 119, width: 3.2 },
  ];
  return [
    {
      id: 'demo3-arrow-shaft',
      color: '#ff3b5c',
      baseWidth: 3.2,
      brushType: 'pen',
      points: resampleHandwritingPoints(shaftRaw, 1.8),
    },
    {
      id: 'demo3-arrow-head',
      color: '#ff3b5c',
      baseWidth: 3.2,
      brushType: 'pen',
      points: resampleHandwritingPoints(headRaw, 1.8),
    },
  ];
}

function buildDemoHeartStrokes(cx: number, cy: number, scale = 1.25): InkStroke[] {
  // Parametric heart curve centered at (cx, cy)
  const rawPts: InkPoint[] = [];
  const steps = 84;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    rawPts.push({
      x: cx + hx * scale,
      y: cy + hy * scale,
      width: 3.4,
    });
  }
  return [
    {
      id: 'demo3-heart-1',
      color: DEMO_PINK_INK,
      baseWidth: 3.4,
      brushType: 'brush',
      points: resampleHandwritingPoints(rawPts, 1.6),
    },
  ];
}

function buildDemoHandwritingStrokes(): InkStroke[] {
  const startX = 278;
  const lineYs = [76, 111, 146] as const;
  const result: InkStroke[] = [];

  DEMO_HANDWRITING_LINES.forEach((lineText, lineIdx) => {
    result.push(
      ...buildHandwritingLineStrokes(lineText, {
        idPrefix: `demo-hw-l${lineIdx}`,
        startX,
        baseY: lineYs[lineIdx],
        glyphW: 6.6,
        glyphH: 15.2,
        unitAdvance: 7.2,
        color: DEMO_PINK_INK,
        baseWidth: 2.0,
      }),
    );
  });

  return result;
}

function sliceHandwritingProgress(
  allStrokes: InkStroke[],
  totalPoints: number,
  progress: number,
): { committed: InkStroke[]; active: InkStroke | null; tip: { x: number; y: number } } {
  if (allStrokes.length === 0 || totalPoints === 0) {
    return { committed: [], active: null, tip: { x: 278, y: 80 } };
  }
  const firstPt = allStrokes[0].points[0];
  const lastStroke = allStrokes[allStrokes.length - 1];
  const lastPt = lastStroke.points[lastStroke.points.length - 1];

  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 0) {
    return { committed: [], active: null, tip: { x: firstPt.x, y: firstPt.y } };
  }
  if (clamped >= 1) {
    return { committed: allStrokes, active: null, tip: { x: lastPt.x, y: lastPt.y } };
  }

  let remaining = Math.max(1, Math.min(totalPoints, Math.round(clamped * totalPoints)));
  const committed: InkStroke[] = [];
  let active: InkStroke | null = null;
  let tip = { x: firstPt.x, y: firstPt.y };

  for (const stroke of allStrokes) {
    const len = stroke.points.length;
    if (remaining >= len) {
      committed.push(stroke);
      tip = { x: stroke.points[len - 1].x, y: stroke.points[len - 1].y };
      remaining -= len;
      if (remaining === 0) break;
    } else {
      const partialPts = stroke.points.slice(0, Math.max(1, remaining));
      const tail = partialPts[partialPts.length - 1];
      active = { ...stroke, points: partialPts };
      tip = { x: tail.x, y: tail.y };
      break;
    }
  }

  return { committed, active, tip };
}

export function App() {
  const [docs, setDocs] = useState<A4Document[]>(loadSavedDocuments);
  const [settings, setSettings] = useState<AppSettings>(loadSavedSettings);
  const [screen, setScreen] = useState<AppScreen>('MENU');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Explorer Menu & Settings state
  const [menuFocusArea, setMenuFocusArea] = useState<'CARDS' | 'DEMO' | 'MANUAL' | 'GEAR'>('CARDS');
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
  const [cardOptionsDocId, setCardOptionsDocId] = useState<string | null>(null);
  const [cardOptionIndex, setCardOptionIndex] = useState<0 | 1>(0);
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState<string | null>(null);
  const [deleteConfirmYes, setDeleteConfirmYes] = useState(false);
  const [settingsRowIndex, setSettingsRowIndex] = useState<0 | 1>(0);
  const [manualSectionIndex, setManualSectionIndex] = useState(0);

  // Document View mode & viewport state
  const [docMode, setDocMode] = useState<DocInteractionMode>('DRAW');
  const [modeSelectorActive, setModeSelectorActive] = useState(false);
  const [hoveredModeIndex, setHoveredModeIndex] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Drawing Mode state & 2-level tree toolbar
  const [drawSubmenu, setDrawSubmenu] = useState<DrawSubmenu>(null);
  const [drawTopIndex, setDrawTopIndex] = useState(0);
  const [drawSubIndex, setDrawSubIndex] = useState(0);
  const [drawTool, setDrawTool] = useState<'brush' | 'shape'>('brush');
  const [selectedThickness, setSelectedThickness] = useState<number>(LINE_THICKNESSES[1]);
  const [selectedColor, setSelectedColor] = useState<string>(TWENTY_COLORS[4].hex);
  const [selectedFillColor, setSelectedFillColor] = useState<string>(TWENTY_COLORS[15].hex);
  const [selectedBrush, setSelectedBrush] = useState<BrushType>('pen');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('circle');
  const [penPos, setPenPos] = useState<{ x: number; y: number }>({
    x: A4_WIDTH * 0.5,
    y: A4_HEIGHT * 0.35,
  });
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);
  const [activeShape, setActiveShape] = useState<DocShape | null>(null);
  const [isErasing, setIsErasing] = useState(false);

  // Writing Mode state & 2-level tree toolbar
  const [writeSubmenu, setWriteSubmenu] = useState<WriteSubmenu>(null);
  const [writeTopIndex, setWriteTopIndex] = useState(0);
  const [writeSubIndex, setWriteSubIndex] = useState(0);
  const [isCursorScrubbing, setIsCursorScrubbing] = useState(false);
  const [showProbe, setShowProbe] = useState(false);
  const [rawInputEvents, setRawInputEvents] = useState<string[]>([]);

  // Telemetry, toast & timed demo state
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>('checking');
  const [scrubRollDeg, setScrubRollDeg] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [demoPhase, setDemoPhase] = useState<
    'IDLE' | 'COUNTDOWN' | 'PHOTO_CAPTURE' | 'RUNNING_UI' | 'UI_OFF'
  >('IDLE');
  const [demoCountdownSec, setDemoCountdownSec] = useState<number | null>(null);
  const [demoFlashOpacity, setDemoFlashOpacity] = useState(0);
  const [demoActionActive, setDemoActionActive] = useState(false);

  // Refs for sensor loops & gesture disambiguation
  const writerInputRef = useRef<HTMLInputElement | null>(null);
  const sensorRef = useRef<WristSensorController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const demoRafRef = useRef<number | null>(null);
  const demoPhaseRef = useRef(demoPhase);
  demoPhaseRef.current = demoPhase;
  const undoMapRef = useRef<Map<string, DocumentHistorySnapshot[]>>(new Map());
  const viewportSizeRef = useRef<{ w: number; h: number }>({ w: 540, h: 360 });
  const holdLockOffsetRef = useRef<{ dx: number; dy: number; dz: number; rollRad: number } | null>(
    null,
  );

  const activeHoldRef = useRef<
    | 'none'
    | 'view-zoom'
    | 'view-pan'
    | 'draw-paint'
    | 'draw-erase'
    | 'double-pending'
    | 'mode-select'
    | 'write-scrub'
  >('none');

  const zoomOriginRef = useRef(1.0);
  const panOriginRef = useRef({ panX: 0, panY: 0 });

  const penPosRef = useRef(penPos);
  penPosRef.current = penPos;
  const hoverOriginRef = useRef({ x: A4_WIDTH * 0.5, y: A4_HEIGHT * 0.35 });
  const drawOriginRef = useRef({ x: A4_WIDTH * 0.5, y: A4_HEIGHT * 0.35 });
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const activeShapeRef = useRef<DocShape | null>(null);
  const erasePrevPosRef = useRef({ x: A4_WIDTH * 0.5, y: A4_HEIGHT * 0.35 });
  const eraseUndoPushedRef = useRef(false);

  const preSelectorModeRef = useRef<DocInteractionMode>('DRAW');
  const hoveredModeIdxRef = useRef(0);
  const writeScrubOriginCharRef = useRef(0);
  const drawHoldStartedAtRef = useRef(0);

  // Keep latest reactive slices for high-frequency sensor callback & popstate
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const activeDocIdRef = useRef(activeDocId);
  activeDocIdRef.current = activeDocId;
  const docModeRef = useRef(docMode);
  docModeRef.current = docMode;
  const modeSelectorActiveRef = useRef(modeSelectorActive);
  modeSelectorActiveRef.current = modeSelectorActive;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef({ panX, panY });
  panRef.current = { panX, panY };
  const drawToolRef = useRef(drawTool);
  drawToolRef.current = drawTool;
  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;
  const selectedFillColorRef = useRef(selectedFillColor);
  selectedFillColorRef.current = selectedFillColor;
  const selectedThicknessRef = useRef(selectedThickness);
  selectedThicknessRef.current = selectedThickness;
  const selectedBrushRef = useRef(selectedBrush);
  selectedBrushRef.current = selectedBrush;
  const selectedShapeRef = useRef(selectedShape);
  selectedShapeRef.current = selectedShape;

  const activeDoc = useMemo(
    () => docs.find(d => d.id === activeDocId) ?? null,
    [activeDocId, docs],
  );
  const activeDocRef = useRef<A4Document | null>(activeDoc);
  activeDocRef.current = activeDoc;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  // Persist docs & settings (debounced so drawing/typing never blocks frame times)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(docs));
      } catch {
        // Ignore quota exceeded errors
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [docs]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore quota exceeded errors
    }
  }, [settings]);

  useEffect(() => {
    sensorRef.current?.setMappingMode(settings.wristMappingMode);
  }, [settings.wristMappingMode]);

  const pushHistorySubstate = useCallback(() => {
    try {
      if (window.history.state?.neuralScreen !== 'sub') {
        window.history.pushState({ neuralScreen: 'sub' }, '');
      }
    } catch {
      // Ignore restricted history state
    }
  }, []);

  const pushUndoSnapshot = useCallback((doc: A4Document) => {
    const list = undoMapRef.current.get(doc.id) ?? [];
    const next = [...list.slice(-(MAX_UNDO_HISTORY - 1)), cloneSnapshot(doc)];
    undoMapRef.current.set(doc.id, next);
  }, []);

  const updateActiveDocument = useCallback(
    (updater: (doc: A4Document) => A4Document, recordUndo = false) => {
      const id = activeDocIdRef.current;
      if (!id) return;
      setDocs(prev =>
        prev.map(doc => {
          if (doc.id !== id) return doc;
          if (recordUndo) pushUndoSnapshot(doc);
          return updater(doc);
        }),
      );
    },
    [pushUndoSnapshot],
  );

  const handleUndo = useCallback(() => {
    const id = activeDocIdRef.current;
    if (!id) return;
    const stack = undoMapRef.current.get(id);
    if (!stack || stack.length === 0) {
      showToast('Nothing to undo');
      return;
    }
    const snap = stack[stack.length - 1];
    undoMapRef.current.set(id, stack.slice(0, -1));
    setDocs(prev =>
      prev.map(doc =>
        doc.id === id
          ? {
              ...doc,
              updatedAt: Date.now(),
              blocks: snap.blocks,
              strokes: snap.strokes,
              shapes: snap.shapes,
              cursor: snap.cursor,
            }
          : doc,
      ),
    );
    showToast('Undo');
  }, [showToast]);

  const applyEraserSegment = useCallback(
    (p0: { x: number; y: number }, p1: { x: number; y: number }) => {
      const id = activeDocIdRef.current;
      if (!id) return;
      setDocs(prev =>
        prev.map(doc => {
          if (doc.id !== id) return doc;
          const remainingStrokes = doc.strokes.filter(
            s => !strokeTouchesEraser(s, p0, p1, ERASER_RADIUS),
          );
          const remainingShapes = doc.shapes.filter(
            sh => !shapeTouchesEraser(sh, p0, p1, ERASER_RADIUS),
          );
          if (
            remainingStrokes.length === doc.strokes.length &&
            remainingShapes.length === doc.shapes.length
          ) {
            return doc;
          }
          if (!eraseUndoPushedRef.current) {
            pushUndoSnapshot(doc);
            eraseUndoPushedRef.current = true;
          }
          return {
            ...doc,
            updatedAt: Date.now(),
            strokes: remainingStrokes,
            shapes: remainingShapes,
          };
        }),
      );
    },
    [pushUndoSnapshot],
  );

  const commitActiveInkOrShape = useCallback(() => {
    const stk = activeStrokeRef.current;
    const shp = activeShapeRef.current;
    activeStrokeRef.current = null;
    activeShapeRef.current = null;
    setActiveStroke(null);
    setActiveShape(null);

    if (stk && stk.points.length >= 1) {
      updateActiveDocument(
        doc => ({
          ...doc,
          updatedAt: Date.now(),
          strokes: [...doc.strokes, stk],
        }),
        true,
      );
    } else if (
      shp &&
      (Math.abs(shp.x2 - shp.x1) >= 4 || Math.abs(shp.y2 - shp.y1) >= 4)
    ) {
      updateActiveDocument(
        doc => ({
          ...doc,
          updatedAt: Date.now(),
          shapes: [...doc.shapes, shp],
        }),
        true,
      );
    }
  }, [updateActiveDocument]);

  const beginDrawOrShapeAt = useCallback((pt: { x: number; y: number }) => {
    const clamped = clampA4Point(pt.x, pt.y);
    if (drawToolRef.current === 'shape') {
      const shp: DocShape = {
        id: makeId('shp'),
        kind: selectedShapeRef.current,
        x1: clamped.x,
        y1: clamped.y,
        x2: clamped.x,
        y2: clamped.y,
        color: selectedColorRef.current,
        strokeWidth: selectedThicknessRef.current,
      };
      activeShapeRef.current = shp;
      setActiveShape(shp);
    } else {
      const stk = createStrokeObject(
        clamped,
        selectedColorRef.current,
        selectedFillColorRef.current,
        selectedThicknessRef.current,
        selectedBrushRef.current,
      );
      activeStrokeRef.current = stk;
      setActiveStroke(stk);
    }
  }, []);

  const updateDrawOrShapeAt = useCallback((pt: { x: number; y: number }) => {
    const clamped = clampA4Point(pt.x, pt.y);
    if (activeShapeRef.current) {
      const nextShape: DocShape = {
        ...activeShapeRef.current,
        x2: clamped.x,
        y2: clamped.y,
      };
      activeShapeRef.current = nextShape;
      setActiveShape(nextShape);
      return;
    }
    if (activeStrokeRef.current) {
      const nextStroke = appendStrokePoint(activeStrokeRef.current, clamped);
      if (nextStroke !== activeStrokeRef.current) {
        activeStrokeRef.current = nextStroke;
        setActiveStroke(nextStroke);
      }
    }
  }, []);

  const enterDocMode = useCallback((nextMode: DocInteractionMode) => {
    activeHoldRef.current = 'none';
    setIsErasing(false);
    setIsCursorScrubbing(false);
    setModeSelectorActive(false);
    setDocMode(nextMode);
    setDrawSubmenu(null);
    setWriteSubmenu(null);
    hoverOriginRef.current = penPosRef.current;
    sensorRef.current?.captureReference();
    const label = DOC_MODES.find(m => m.id === nextMode)?.label ?? nextMode;
    showToast(label);
  }, [showToast]);

  const openDocument = useCallback(
    (docId: string) => {
      activeHoldRef.current = 'none';
      setActiveDocId(docId);
      setScreen('DOCUMENT');
      setDocMode('DRAW');
      setModeSelectorActive(false);
      setHoveredModeIndex(0);
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      setDrawSubmenu(null);
      setWriteSubmenu(null);
      setCardOptionsDocId(null);
      setDeleteConfirmDocId(null);
      hoverOriginRef.current = { x: A4_WIDTH * 0.5, y: A4_HEIGHT * 0.35 };
      setPenPos({ x: A4_WIDTH * 0.5, y: A4_HEIGHT * 0.35 });
      pushHistorySubstate();
    },
    [pushHistorySubstate],
  );

  const handleCreateNewDoc = useCallback(() => {
    const currentDocs = docsRef.current;
    const maxNum = currentDocs.reduce((m, d) => Math.max(m, d.docNumber), 0);
    const created = createEmptyDocument(maxNum + 1);
    const nextDocs = [...currentDocs, created];
    const createdIdx = nextDocs.length - 1;
    setDocs(nextDocs);
    setMenuSelectedIndex(createdIdx);
    openDocument(created.id);
    showToast(`Created Document ${created.docNumber}`);
  }, [openDocument, showToast]);

  const handleTogglePinDoc = useCallback(
    (docId: string) => {
      setDocs(prev => {
        const next = prev.map(d => (d.id === docId ? { ...d, pinned: !d.pinned } : d));
        return sortDocsWithPinnedFirst(next);
      });
      setCardOptionsDocId(null);
      setMenuSelectedIndex(0);
      showToast('Updated document pin');
    },
    [showToast],
  );

  const handleConfirmDeleteDoc = useCallback(
    (docId: string) => {
      setDocs(prev => {
        const remaining = prev.filter(d => d.id !== docId);
        setMenuSelectedIndex(idx => Math.max(0, Math.min(idx, remaining.length)));
        return remaining;
      });
      undoMapRef.current.delete(docId);
      setDeleteConfirmDocId(null);
      setCardOptionsDocId(null);
      showToast('Document deleted');
    },
    [showToast],
  );

  const handleViewportResize = useCallback((w: number, h: number) => {
    viewportSizeRef.current = { w, h };
  }, []);

  // Initialize WristSensorController once
  useEffect(() => {
    const controller = new WristSensorController({
      initialMappingMode: settings.wristMappingMode,
      onStatusChange: status => setSensorStatus(status),
      onReading: t => {
        if (demoPhaseRef.current !== 'IDLE' || !t.deltaPointing || screenRef.current !== 'DOCUMENT') {
          return;
        }

        const { dx, dy, dz } = t.deltaPointing;
        const deltaPxX = dx * POINTER_SCALE;
        const deltaPxY = dy * POINTER_SCALE;
        const deltaPxZ = dz * POINTER_SCALE;
        const absRoll = Math.abs(t.rollDeg);

        // 1. Disambiguate 2x Hold into strictly exclusive Mode Selector, Zoom-Only, or Pan-Only
        if (activeHoldRef.current === 'double-pending') {
          const canPan = zoomRef.current > 1.02;
          if (
            (!canPan || modeSelectorActiveRef.current) &&
            absRoll >= 4.5 &&
            Math.hypot(deltaPxX, deltaPxY) < 14
          ) {
            activeHoldRef.current = 'mode-select';
            setModeSelectorActive(true);
          } else {
            const zoomMag = Math.abs(deltaPxY);
            const panMag = Math.hypot(deltaPxX, deltaPxZ);
            if (zoomMag >= 8 && (!canPan || zoomMag > panMag * 1.15)) {
              activeHoldRef.current = 'view-zoom';
              holdLockOffsetRef.current = {
                dx,
                dy,
                dz,
                rollRad: (t.rollDeg * Math.PI) / 180,
              };
            } else if (canPan && panMag >= 6 && panMag >= zoomMag * 0.9) {
              activeHoldRef.current = 'view-pan';
              holdLockOffsetRef.current = {
                dx,
                dy,
                dz,
                rollRad: (t.rollDeg * Math.PI) / 180,
              };
            } else {
              return;
            }
          }
        }

        // 2. Bottom Mode Bar hover via forearm roll (activated ONLY by 2x Tap Hold + Rotate)
        if (activeHoldRef.current === 'mode-select') {
          const effectiveDeg =
            absRoll <= 3.0 ? 0 : t.rollDeg > 0 ? t.rollDeg - 3.0 : t.rollDeg + 3.0;
          const offset = Math.round(effectiveDeg / 9.0);
          const originIdx = DOC_MODES.findIndex(m => m.id === preSelectorModeRef.current);
          const nextIdx = Math.max(0, Math.min(DOC_MODES.length - 1, originIdx + offset));
          if (nextIdx !== hoveredModeIdxRef.current) {
            hoveredModeIdxRef.current = nextIdx;
            setHoveredModeIndex(nextIdx);
          }
          return;
        }

        // 3a. Exclusive Zoom Mode (2x Tap Hold + Move Up/Down on Zoom axis dy)
        if (activeHoldRef.current === 'view-zoom') {
          const lockDy = holdLockOffsetRef.current?.dy ?? 0;
          const effDyPx = (dy - lockDy) * POINTER_SCALE;
          const zoomDelta = effDyPx / 135;
          const nextZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, zoomOriginRef.current + zoomDelta),
          );
          const clamped = clampPanToZoom(
            panRef.current.panX,
            panRef.current.panY,
            nextZoom,
            viewportSizeRef.current,
          );
          setZoom(nextZoom);
          setPanX(clamped.panX);
          setPanY(clamped.panY);
          return;
        }

        // 3b. Exclusive Pan/Drag Mode (2x Tap Hold + Left/Right dx or 3rd-axis Up/Down dz)
        if (activeHoldRef.current === 'view-pan') {
          const lockDx = holdLockOffsetRef.current?.dx ?? 0;
          const lockDz = holdLockOffsetRef.current?.dz ?? 0;
          const effDxPx = (dx - lockDx) * POINTER_SCALE;
          const effDzPx = (dz - lockDz) * POINTER_SCALE;
          const rawPanX = panOriginRef.current.panX - effDxPx * 2.4;
          const rawPanY = panOriginRef.current.panY + effDzPx * 2.5;
          const clamped = clampPanToZoom(
            rawPanX,
            rawPanY,
            zoomRef.current,
            viewportSizeRef.current,
          );
          setPanX(clamped.panX);
          setPanY(clamped.panY);
          return;
        }

        const hold = activeHoldRef.current;
        const mode = docModeRef.current;

        // 4. DRAW MODE
        if (mode === 'DRAW') {
          if (hold === 'draw-erase') {
            const nextPt = clampA4Point(
              drawOriginRef.current.x + deltaPxX,
              drawOriginRef.current.y + deltaPxY,
            );
            applyEraserSegment(erasePrevPosRef.current, nextPt);
            erasePrevPosRef.current = nextPt;
            setPenPos(nextPt);
            return;
          }

          if (hold === 'draw-paint') {
            const target = clampA4Point(
              drawOriginRef.current.x + deltaPxX,
              drawOriginRef.current.y + deltaPxY,
            );
            // Smooth 2.5px lazy-brush filter to tame wristband jitter while staying responsive
            const cur = penPosRef.current;
            const dist = Math.hypot(target.x - cur.x, target.y - cur.y);
            const smoothed =
              dist <= 2.5
                ? target
                : {
                    x: cur.x + (target.x - cur.x) * 0.68,
                    y: cur.y + (target.y - cur.y) * 0.68,
                  };
            setPenPos(smoothed);
            updateDrawOrShapeAt(smoothed);
            return;
          }

          // Continuous Draw crosshair hover when not holding
          if (hold === 'none') {
            const target = clampA4Point(
              hoverOriginRef.current.x + deltaPxX,
              hoverOriginRef.current.y + deltaPxY,
            );
            const cur = penPosRef.current;
            const smoothed = {
              x: cur.x + (target.x - cur.x) * 0.55,
              y: cur.y + (target.y - cur.y) * 0.55,
            };
            if (Math.hypot(smoothed.x - cur.x, smoothed.y - cur.y) >= 0.35) {
              setPenPos(smoothed);
            }
          }
          return;
        }

        // 5. WRITE MODE: 1x Hold + Rotate Arm scrubs character cursor along line
        if (mode === 'WRITE' && hold === 'write-scrub') {
          setScrubRollDeg(prev => (Math.abs(prev - t.rollDeg) >= 0.5 ? t.rollDeg : prev));
          const doc = activeDocRef.current;
          if (!doc) return;
          const block = doc.blocks[doc.cursor.lineIndex];
          const maxChar = block ? block.text.length : 0;
          const stepOffset = Math.round(t.rollDeg / CURSOR_SCRUB_STEP_DEG);
          const nextChar = Math.max(0, Math.min(maxChar, writeScrubOriginCharRef.current + stepOffset));
          if (nextChar !== doc.cursor.charIndex) {
            setDocs(prev =>
              prev.map(d =>
                d.id === doc.id
                  ? { ...d, cursor: { ...d.cursor, charIndex: nextChar } }
                  : d,
              ),
            );
          }
        }
      },
    });
    sensorRef.current = controller;
    controller.start();
    return () => controller.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Writing operations
  const handleCommitText = useCallback(
    (incomingText: string) => {
      if (!incomingText) return;
      updateActiveDocument(doc => {
        const lineIdx = Math.max(0, Math.min(doc.blocks.length - 1, doc.cursor.lineIndex));
        const blocks = doc.blocks.map((blk, i) => {
          if (i !== lineIdx) return blk;
          const c = Math.max(0, Math.min(blk.text.length, doc.cursor.charIndex));
          return {
            ...blk,
            text: `${blk.text.slice(0, c)}${incomingText}${blk.text.slice(c)}`,
          };
        });
        return {
          ...doc,
          updatedAt: Date.now(),
          blocks,
          cursor: {
            lineIndex: lineIdx,
            charIndex: (doc.cursor.charIndex || 0) + incomingText.length,
          },
        };
      }, true);
    },
    [updateActiveDocument],
  );

  const handleNewLine = useCallback(() => {
    updateActiveDocument(doc => {
      const lineIdx = Math.max(0, Math.min(doc.blocks.length - 1, doc.cursor.lineIndex));
      const curBlk = doc.blocks[lineIdx];
      const splitAt = Math.max(0, Math.min(curBlk.text.length, doc.cursor.charIndex));
      const before = curBlk.text.slice(0, splitAt);
      const after = curBlk.text.slice(splitAt);
      const nextKind: BlockKind =
        curBlk.kind === 'bullet' || curBlk.kind === 'numbered' ? curBlk.kind : 'p';
      const updatedCurrent: DocBlock = { ...curBlk, text: before };
      const inserted: DocBlock = {
        id: makeId('blk'),
        kind: nextKind,
        text: after,
        fontSize: curBlk.fontSize ?? 15,
      };
      const blocks = [
        ...doc.blocks.slice(0, lineIdx),
        updatedCurrent,
        inserted,
        ...doc.blocks.slice(lineIdx + 1),
      ];
      return {
        ...doc,
        updatedAt: Date.now(),
        blocks,
        cursor: { lineIndex: lineIdx + 1, charIndex: 0 },
      };
    }, true);
  }, [updateActiveDocument]);

  const handleBackspace = useCallback(() => {
    updateActiveDocument(doc => {
      const lineIdx = Math.max(0, Math.min(doc.blocks.length - 1, doc.cursor.lineIndex));
      const curBlk = doc.blocks[lineIdx];
      const c = Math.max(0, Math.min(curBlk.text.length, doc.cursor.charIndex));
      if (c > 0) {
        const blocks = doc.blocks.map((b, i) =>
          i === lineIdx ? { ...b, text: `${b.text.slice(0, c - 1)}${b.text.slice(c)}` } : b,
        );
        return {
          ...doc,
          updatedAt: Date.now(),
          blocks,
          cursor: { lineIndex: lineIdx, charIndex: c - 1 },
        };
      }
      if (lineIdx > 0) {
        const prevBlk = doc.blocks[lineIdx - 1];
        const mergedChar = prevBlk.text.length;
        const merged: DocBlock = { ...prevBlk, text: prevBlk.text + curBlk.text };
        const blocks = [
          ...doc.blocks.slice(0, lineIdx - 1),
          merged,
          ...doc.blocks.slice(lineIdx + 1),
        ];
        return {
          ...doc,
          updatedAt: Date.now(),
          blocks,
          cursor: { lineIndex: lineIdx - 1, charIndex: mergedChar },
        };
      }
      return doc;
    }, true);
  }, [updateActiveDocument]);

  const moveWriteLine = useCallback(
    (delta: -1 | 1) => {
      updateActiveDocument(doc => {
        const nextLine = Math.max(
          0,
          Math.min(doc.blocks.length - 1, doc.cursor.lineIndex + delta),
        );
        const len = doc.blocks[nextLine]?.text.length ?? 0;
        return {
          ...doc,
          cursor: { lineIndex: nextLine, charIndex: Math.min(doc.cursor.charIndex, len) },
        };
      });
    },
    [updateActiveDocument],
  );

  // Middle Finger / Back hierarchical navigation
  const handleMiddleFingerBack = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
    ) {
      activeEl.blur();
    }

    if (screen === 'MENU') {
      if (deleteConfirmDocId || cardOptionsDocId) {
        setDeleteConfirmDocId(null);
        setCardOptionsDocId(null);
        showToast('Closed options');
        return;
      }
      if (menuFocusArea === 'DEMO' || menuFocusArea === 'GEAR' || menuFocusArea === 'MANUAL') {
        setMenuFocusArea('CARDS');
      }
      return;
    }

    if (screen === 'SETTINGS' || screen === 'MANUAL') {
      setScreen('MENU');
      showToast('Menu');
      return;
    }

    // screen === 'DOCUMENT'
    if (modeSelectorActive) {
      activeHoldRef.current = 'none';
      setModeSelectorActive(false);
      setDocMode(preSelectorModeRef.current);
      showToast('Mode selection cancelled');
      return;
    }

    if (docMode === 'DRAW' && drawSubmenu !== null) {
      setDrawSubmenu(null);
      return;
    }

    if (docMode === 'WRITE' && writeSubmenu !== null) {
      setWriteSubmenu(null);
      return;
    }

    // Top level of any document mode -> save & return to Menu
    commitActiveInkOrShape();
    activeHoldRef.current = 'none';
    setIsErasing(false);
    setIsCursorScrubbing(false);
    setScreen('MENU');
    setActiveDocId(null);
    showToast('Saved & returned to Menu');
  }, [
    cardOptionsDocId,
    commitActiveInkOrShape,
    deleteConfirmDocId,
    docMode,
    drawSubmenu,
    menuFocusArea,
    modeSelectorActive,
    screen,
    showToast,
    writeSubmenu,
  ]);

  const backHandlerRef = useRef(handleMiddleFingerBack);
  backHandlerRef.current = handleMiddleFingerBack;

  // Browser / Android WebView Back button (`popstate`) mapped to Middle Finger Back
  useEffect(() => {
    const onPopState = () => {
      const wasInSubScreen = screenRef.current !== 'MENU';
      const hadOverlayInDoc =
        screenRef.current === 'DOCUMENT' &&
        (modeSelectorActive ||
          (docModeRef.current === 'DRAW' && drawSubmenu !== null) ||
          (docModeRef.current === 'WRITE' && writeSubmenu !== null));
      backHandlerRef.current();
      if (wasInSubScreen && hadOverlayInDoc) {
        pushHistorySubstate();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [drawSubmenu, modeSelectorActive, pushHistorySubstate, writeSubmenu]);

  // Confirm hovered mode from bottom bar
  const confirmHoveredMode = useCallback(() => {
    const target = DOC_MODES[hoveredModeIdxRef.current]?.id ?? docMode;
    enterDocMode(target);
  }, [enterDocMode, docMode]);

  // Toolbar option handlers
  const handleSelectDrawTop = useCallback(
    (idx: number, submenu: Exclude<DrawSubmenu, null>) => {
      setDrawTopIndex(idx);
      setDrawSubmenu(submenu);
      setDrawSubIndex(0);
    },
    [],
  );

  const handleSelectWriteTop = useCallback(
    (idx: number, submenu: Exclude<WriteSubmenu, null>) => {
      setWriteTopIndex(idx);
      setWriteSubmenu(submenu);
      setWriteSubIndex(0);
      if (submenu === 'input') {
        window.setTimeout(() => writerInputRef.current?.focus(), 20);
      }
    },
    [],
  );

  const applyDrawSubOption = useCallback((submenu: Exclude<DrawSubmenu, null>, idx: number) => {
    if (submenu === 'thickness') {
      const val = LINE_THICKNESSES[idx] ?? LINE_THICKNESSES[0];
      setSelectedThickness(val);
      showToast(`Thickness: ${val}px`);
    } else if (submenu === 'color') {
      const item = TWENTY_COLORS[idx] ?? TWENTY_COLORS[0];
      setSelectedColor(item.hex);
      showToast(`Color: ${item.name}`);
    } else if (submenu === 'brush') {
      const item = BRUSH_TYPES[idx] ?? BRUSH_TYPES[0];
      setSelectedBrush(item.id);
      setDrawTool('brush');
      showToast(`Brush: ${item.label}`);
    } else if (submenu === 'shape') {
      const item = SHAPE_TYPES[idx] ?? SHAPE_TYPES[0];
      setSelectedShape(item.id);
      setDrawTool('shape');
      showToast(`Shape: ${item.label}`);
    } else if (submenu === 'fill') {
      const item = TWENTY_COLORS[idx] ?? TWENTY_COLORS[0];
      setSelectedFillColor(item.hex);
      showToast(`Fill color: ${item.name}`);
    }
  }, [showToast]);

  const applyWriteStyleOption = useCallback(
    (kind: BlockKind, idx: number) => {
      setWriteSubIndex(idx);
      updateActiveDocument(doc => {
        const lineIdx = doc.cursor.lineIndex;
        const defaultSize =
          kind === 'h1' ? 22 : kind === 'h2' ? 18 : kind === 'h3' ? 16 : 15;
        return {
          ...doc,
          updatedAt: Date.now(),
          blocks: doc.blocks.map((b, i) =>
            i === lineIdx ? { ...b, kind, fontSize: defaultSize } : b,
          ),
        };
      }, true);
    },
    [updateActiveDocument],
  );

  const toggleWriteFormatOption = useCallback(
    (fmt: 'bold' | 'italic' | 'underline', idx: number) => {
      setWriteSubIndex(idx);
      updateActiveDocument(doc => {
        const lineIdx = doc.cursor.lineIndex;
        return {
          ...doc,
          updatedAt: Date.now(),
          blocks: doc.blocks.map((b, i) =>
            i === lineIdx ? { ...b, [fmt]: !b[fmt] } : b,
          ),
        };
      }, true);
    },
    [updateActiveDocument],
  );

  const applyWriteSizeOption = useCallback(
    (pt: number, idx: number) => {
      setWriteSubIndex(idx);
      updateActiveDocument(doc => {
        const lineIdx = doc.cursor.lineIndex;
        return {
          ...doc,
          updatedAt: Date.now(),
          blocks: doc.blocks.map((b, i) => (i === lineIdx ? { ...b, fontSize: pt } : b)),
        };
      }, true);
    },
    [updateActiveDocument],
  );

  const applyWriteListOption = useCallback(
    (kind: BlockKind, idx: number) => {
      setWriteSubIndex(idx);
      updateActiveDocument(doc => {
        const lineIdx = doc.cursor.lineIndex;
        return {
          ...doc,
          updatedAt: Date.now(),
          blocks: doc.blocks.map((b, i) => (i === lineIdx ? { ...b, kind } : b)),
        };
      }, true);
    },
    [updateActiveDocument],
  );

  const applyWriteSubOption = useCallback(
    (submenu: Exclude<WriteSubmenu, null>, idx: number) => {
      if (submenu === 'style') {
        const opt = WRITE_STYLE_OPTIONS[idx];
        if (opt) applyWriteStyleOption(opt.kind, idx);
      } else if (submenu === 'format') {
        const keys = ['bold', 'italic', 'underline'] as const;
        const fmt = keys[idx];
        if (fmt) toggleWriteFormatOption(fmt, idx);
      } else if (submenu === 'size') {
        const pt = FONT_SIZES[idx];
        if (pt) applyWriteSizeOption(pt, idx);
      } else if (submenu === 'list') {
        const opt = WRITE_LIST_OPTIONS[idx];
        if (opt) applyWriteListOption(opt.kind, idx);
      } else if (submenu === 'input') {
        writerInputRef.current?.focus();
      }
    },
    [
      applyWriteListOption,
      applyWriteSizeOption,
      applyWriteStyleOption,
      toggleWriteFormatOption,
    ],
  );

  const handleOpenManual = useCallback(() => {
    setScreen('MANUAL');
    setManualSectionIndex(0);
    pushHistorySubstate();
  }, [pushHistorySubstate]);

  const handleOpenSettings = useCallback(() => {
    setScreen('SETTINGS');
    setSettingsRowIndex(0);
    pushHistorySubstate();
  }, [pushHistorySubstate]);

  const handleBackToMenu = useCallback(() => {
    setScreen('MENU');
    showToast('Menu');
  }, [showToast]);

  const handleExitDemo = useCallback(() => {
    if (demoRafRef.current !== null) {
      cancelAnimationFrame(demoRafRef.current);
      demoRafRef.current = null;
    }
    setDemoFlashOpacity(0);
    setDemoCountdownSec(null);
    setDemoActionActive(false);
    setActiveStroke(null);
    setDemoPhase('IDLE');
    setActiveDocId(null);
    setScreen('MENU');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && demoPhaseRef.current !== 'IDLE') {
        handleExitDemo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (demoRafRef.current !== null) {
        cancelAnimationFrame(demoRafRef.current);
        demoRafRef.current = null;
      }
    };
  }, [handleExitDemo]);

  const handleStartDemo = useCallback(() => {
    if (demoRafRef.current !== null) {
      cancelAnimationFrame(demoRafRef.current);
      demoRafRef.current = null;
    }

    // Seed all 4 Demo 3 documents fresh so Menu matches the exact 4-document state
    const nextDocs = createSeedDocuments();
    const targetIdx = 3;
    const targetDocId = nextDocs[targetIdx].id;

    const waveStrokes = buildDemoWaveStrokes();
    const waveTotalPts = waveStrokes.reduce((s, st) => s + st.points.length, 0);

    const arrowStrokes = buildDemoArrowStrokes();
    const arrowTotalPts = arrowStrokes.reduce((s, st) => s + st.points.length, 0);

    const importantStrokes = buildHandwritingLineStrokes('important!', {
      idPrefix: 'demo3-imp',
      startX: 438,
      baseY: 112,
      glyphW: 6.4,
      glyphH: 15,
      unitAdvance: 7.0,
      color: '#ff3b5c',
      baseWidth: 2.0,
    });
    const importantTotalPts = importantStrokes.reduce((s, st) => s + st.points.length, 0);

    const loveStrokes = buildHandwritingLineStrokes('I love you', {
      idPrefix: 'demo3-love',
      startX: 168,
      baseY: 678,
      glyphW: 9.2,
      glyphH: 21,
      unitAdvance: 10.2,
      color: DEMO_PINK_INK,
      baseWidth: 2.6,
    });
    const loveTotalPts = loveStrokes.reduce((s, st) => s + st.points.length, 0);

    const heartStrokes = buildDemoHeartStrokes(338, 690, 1.15);
    const heartTotalPts = heartStrokes.reduce((s, st) => s + st.points.length, 0);

    const diagRect: DocShape = {
      id: 'demo3-shape-rect',
      kind: 'rectangle',
      x1: 86,
      y1: 445,
      x2: 206,
      y2: 525,
      color: '#06b6d4',
      strokeWidth: 4,
    };
    const diagArrow: DocShape = {
      id: 'demo3-shape-arrow',
      kind: 'arrow',
      x1: 218,
      y1: 485,
      x2: 314,
      y2: 485,
      color: '#f59e0b',
      strokeWidth: 4,
    };
    const diagCircle: DocShape = {
      id: 'demo3-shape-circle',
      kind: 'circle',
      x1: 328,
      y1: 440,
      x2: 428,
      y2: 530,
      color: '#10b981',
      strokeWidth: 4,
    };

    const setDocContent = (strokes: InkStroke[], shapes: DocShape[]) => {
      setDocs(prev =>
        prev.map(d =>
          d.id === targetDocId ? { ...d, updatedAt: Date.now(), strokes, shapes } : d,
        ),
      );
    };

    setDocs(nextDocs);
    setToast(null);
    setActiveStroke(null);
    setActiveShape(null);
    setIsErasing(false);
    setCardOptionsDocId(null);
    setDeleteConfirmDocId(null);
    setActiveDocId(null);
    setScreen('MENU');
    setMenuFocusArea('CARDS');
    setMenuSelectedIndex(0);
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setDemoFlashOpacity(0);
    setDemoActionActive(false);
    setDemoCountdownSec(3);
    setDemoPhase('COUNTDOWN');

    const t0 = performance.now() + 3000;
    let committedArrowCount = -1;
    let committedImpCount = -1;
    let committedLoveCount = -1;
    let stage = 'countdown';

    const tick = (now: number) => {
      const elapsedSec = (now - t0) / 1000;

      if (elapsedSec < 0) {
        const cd = elapsedSec < -0.4 ? Math.ceil(-elapsedSec) : null;
        setDemoCountdownSec(prev => (prev === cd ? prev : cd));
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 0.0s .. 1.0s: Menu visible with 4 documents; highlight 4th document before opening
      if (elapsedSec < 1.0) {
        if (stage !== 'menu-start') {
          stage = 'menu-start';
          setDemoCountdownSec(null);
          setDemoPhase('RUNNING_UI');
          setScreen('MENU');
          setActiveDocId(null);
          setMenuFocusArea('CARDS');
          setMenuSelectedIndex(0);
        }
        if (elapsedSec >= 0.45) {
          setMenuSelectedIndex(targetIdx);
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 1.0s .. 3.0s: Open 4th document (2 Junction bullets)
      if (elapsedSec < 3.0) {
        if (stage !== 'doc-open') {
          stage = 'doc-open';
          setActiveDocId(targetDocId);
          setScreen('DOCUMENT');
          setDocMode('DRAW');
          setModeSelectorActive(false);
          setDrawSubmenu(null);
          setWriteSubmenu(null);
          setDrawTool('brush');
          setSelectedBrush('pen');
          setSelectedColor('#06b6d4');
          setSelectedThickness(4);
          setZoom(1.0);
          setPanX(0);
          setPanY(0);
          setActiveStroke(null);
          setActiveShape(null);
          setIsErasing(false);
          setPenPos(waveStrokes[0].points[0]);
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 3.0s .. 5.0s: Draw wave motion
      if (elapsedSec < 5.0) {
        stage = 'wave';
        const p = Math.max(0, Math.min(1, (elapsedSec - 3.0) / 2.0));
        const slice = sliceHandwritingProgress(waveStrokes, waveTotalPts, p);
        setPenPos(slice.tip);
        setActiveStroke(slice.active);
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 5.0s .. 6.0s: Hold wave before upper zoom
      if (elapsedSec < 6.0) {
        if (stage !== 'wave-done') {
          stage = 'wave-done';
          setActiveStroke(null);
          setDocContent(waveStrokes, []);
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 6.0s .. 9.0s: Zoom into top part, draw arrow to 2nd bullet + "important!", then zoom out
      if (elapsedSec < 9.0) {
        if (elapsedSec < 6.6) {
          stage = 'top-zoom-in';
          const u = Math.max(0, Math.min(1, (elapsedSec - 6.0) / 0.6));
          const s = u * u * (3 - 2 * u);
          const nextZoom = 1.0 + s * 1.15;
          const clamped = clampPanToZoom(-150 * s, 340 * s, nextZoom, viewportSizeRef.current);
          setZoom(nextZoom);
          setPanX(clamped.panX);
          setPanY(clamped.panY);
          setSelectedColor('#ff3b5c');
          setPenPos(arrowStrokes[0].points[0]);
        } else if (elapsedSec < 7.2) {
          if (stage !== 'top-arrow') {
            stage = 'top-arrow';
            const clamped = clampPanToZoom(-150, 340, 2.15, viewportSizeRef.current);
            setZoom(2.15);
            setPanX(clamped.panX);
            setPanY(clamped.panY);
          }
          const p = Math.max(0, Math.min(1, (elapsedSec - 6.6) / 0.6));
          const slice = sliceHandwritingProgress(arrowStrokes, arrowTotalPts, p);
          setPenPos(slice.tip);
          setActiveStroke(slice.active);
          if (slice.committed.length !== committedArrowCount) {
            committedArrowCount = slice.committed.length;
            setDocContent([...waveStrokes, ...slice.committed], []);
          }
        } else if (elapsedSec < 8.4) {
          if (stage !== 'top-imp') {
            stage = 'top-imp';
            setActiveStroke(null);
            setDocContent([...waveStrokes, ...arrowStrokes], []);
          }
          const p = Math.max(0, Math.min(1, (elapsedSec - 7.2) / 1.2));
          const slice = sliceHandwritingProgress(importantStrokes, importantTotalPts, p);
          setPenPos(slice.tip);
          setActiveStroke(slice.active);
          if (slice.committed.length !== committedImpCount) {
            committedImpCount = slice.committed.length;
            setDocContent([...waveStrokes, ...arrowStrokes, ...slice.committed], []);
          }
        } else {
          if (stage !== 'top-zoom-out') {
            stage = 'top-zoom-out';
            setActiveStroke(null);
            setDocContent([...waveStrokes, ...arrowStrokes, ...importantStrokes], []);
          }
          const u = Math.max(0, Math.min(1, (elapsedSec - 8.4) / 0.6));
          const s = 1 - u * u * (3 - 2 * u);
          const nextZoom = 1.0 + s * 1.15;
          const clamped = clampPanToZoom(-150 * s, 340 * s, nextZoom, viewportSizeRef.current);
          setZoom(nextZoom);
          setPanX(clamped.panX);
          setPanY(clamped.panY);
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 9.0s .. 10.0s: Hold at 1.0x before drawing 3-shape diagram
      if (elapsedSec < 10.0) {
        if (stage !== 'top-done') {
          stage = 'top-done';
          setZoom(1.0);
          setPanX(0);
          setPanY(0);
          setActiveStroke(null);
          setDocContent([...waveStrokes, ...arrowStrokes, ...importantStrokes], []);
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 10.0s .. 13.0s: Draw 3-shape diagram on lower half of document
      if (elapsedSec < 13.0) {
        const preShapesStrokes = [...waveStrokes, ...arrowStrokes, ...importantStrokes];
        if (elapsedSec < 11.0) {
          stage = 'diag-1';
          const p = Math.max(0.08, Math.min(1, (elapsedSec - 10.0) / 0.9));
          const curX2 = diagRect.x1 + (diagRect.x2 - diagRect.x1) * p;
          const curY2 = diagRect.y1 + (diagRect.y2 - diagRect.y1) * p;
          setSelectedColor(diagRect.color);
          setPenPos({ x: curX2, y: curY2 });
          setActiveShape({ ...diagRect, x2: curX2, y2: curY2 });
        } else if (elapsedSec < 12.0) {
          if (stage !== 'diag-2') {
            stage = 'diag-2';
            setDocContent(preShapesStrokes, [diagRect]);
          }
          const p = Math.max(0.08, Math.min(1, (elapsedSec - 11.0) / 0.9));
          const curX2 = diagArrow.x1 + (diagArrow.x2 - diagArrow.x1) * p;
          setSelectedColor(diagArrow.color);
          setPenPos({ x: curX2, y: diagArrow.y2 });
          setActiveShape({ ...diagArrow, x2: curX2 });
        } else {
          if (stage !== 'diag-3') {
            stage = 'diag-3';
            setDocContent(preShapesStrokes, [diagRect, diagArrow]);
          }
          const p = Math.max(0.08, Math.min(1, (elapsedSec - 12.0) / 0.9));
          const curX2 = diagCircle.x1 + (diagCircle.x2 - diagCircle.x1) * p;
          const curY2 = diagCircle.y1 + (diagCircle.y2 - diagCircle.y1) * p;
          setSelectedColor(diagCircle.color);
          setPenPos({ x: curX2, y: curY2 });
          setActiveShape({ ...diagCircle, x2: curX2, y2: curY2 });
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 13.0s .. 15.0s: Commit 3-shape diagram and hold before bottom zoom
      if (elapsedSec < 15.0) {
        if (stage !== 'diag-done') {
          stage = 'diag-done';
          setActiveShape(null);
          setDocContent(
            [...waveStrokes, ...arrowStrokes, ...importantStrokes],
            [diagRect, diagArrow, diagCircle],
          );
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t = 15.0s .. 19.0s: Zoom into bottom edge, write "I love you" + draw heart, then zoom out
      const baseStrokes = [...waveStrokes, ...arrowStrokes, ...importantStrokes];
      const baseShapes = [diagRect, diagArrow, diagCircle];

      if (elapsedSec < 19.0) {
        if (elapsedSec < 15.65) {
          stage = 'bot-zoom-in';
          const u = Math.max(0, Math.min(1, (elapsedSec - 15.0) / 0.65));
          const s = u * u * (3 - 2 * u);
          const nextZoom = 1.0 + s * 1.3;
          const clamped = clampPanToZoom(0, -360 * s, nextZoom, viewportSizeRef.current);
          setZoom(nextZoom);
          setPanX(clamped.panX);
          setPanY(clamped.panY);
          setSelectedColor(DEMO_PINK_INK);
          setPenPos(loveStrokes[0].points[0]);
        } else if (elapsedSec < 17.35) {
          if (stage !== 'bot-love') {
            stage = 'bot-love';
            const clamped = clampPanToZoom(0, -360, 2.3, viewportSizeRef.current);
            setZoom(2.3);
            setPanX(clamped.panX);
            setPanY(clamped.panY);
          }
          const p = Math.max(0, Math.min(1, (elapsedSec - 15.65) / 1.7));
          const slice = sliceHandwritingProgress(loveStrokes, loveTotalPts, p);
          setPenPos(slice.tip);
          setActiveStroke(slice.active);
          if (slice.committed.length !== committedLoveCount) {
            committedLoveCount = slice.committed.length;
            setDocContent([...baseStrokes, ...slice.committed], baseShapes);
          }
        } else if (elapsedSec < 18.35) {
          if (stage !== 'bot-heart') {
            stage = 'bot-heart';
            setActiveStroke(null);
            setDocContent([...baseStrokes, ...loveStrokes], baseShapes);
          }
          const p = Math.max(0, Math.min(1, (elapsedSec - 17.35) / 1.0));
          const slice = sliceHandwritingProgress(heartStrokes, heartTotalPts, p);
          setPenPos(slice.tip);
          setActiveStroke(slice.active);
        } else {
          if (stage !== 'bot-zoom-out') {
            stage = 'bot-zoom-out';
            setActiveStroke(null);
            setDocContent([...baseStrokes, ...loveStrokes, ...heartStrokes], baseShapes);
          }
          const u = Math.max(0, Math.min(1, (elapsedSec - 18.35) / 0.65));
          const s = 1 - u * u * (3 - 2 * u);
          const nextZoom = 1.0 + s * 1.3;
          const clamped = clampPanToZoom(0, -360 * s, nextZoom, viewportSizeRef.current);
          setZoom(nextZoom);
          setPanX(clamped.panX);
          setPanY(clamped.panY);
        }
        demoRafRef.current = requestAnimationFrame(tick);
        return;
      }

      // t >= 19.0s: Demo finished cleanly at 1.0x full document view
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      setActiveStroke(null);
      setActiveShape(null);
      setDocContent([...baseStrokes, ...loveStrokes, ...heartStrokes], baseShapes);
      demoRafRef.current = null;
    };

    demoRafRef.current = requestAnimationFrame(tick);
  }, []);

  // Unified Wristband Gesture Handlers
  const handleSwipe = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (screen === 'MENU') {
        if (deleteConfirmDocId) {
          if (dir === 'left' || dir === 'right') {
            setDeleteConfirmYes(v => !v);
          }
          return;
        }
        if (cardOptionsDocId) {
          if (dir === 'left' || dir === 'right') {
            setCardOptionIndex(i => (i === 0 ? 1 : 0));
          }
          return;
        }
        if (dir === 'up') {
          if (menuFocusArea === 'CARDS') {
            if (menuSelectedIndex >= 3) {
              setMenuSelectedIndex(idx => idx - 3);
            } else {
              setMenuFocusArea(
                menuSelectedIndex === 0 ? 'DEMO' : menuSelectedIndex === 1 ? 'MANUAL' : 'GEAR',
              );
            }
          }
          return;
        }
        if (dir === 'down') {
          if (menuFocusArea !== 'CARDS') {
            setMenuFocusArea('CARDS');
          } else if (menuSelectedIndex + 3 <= docs.length) {
            setMenuSelectedIndex(idx => idx + 3);
          }
          return;
        }
        if (menuFocusArea === 'CARDS') {
          setMenuSelectedIndex(idx =>
            Math.max(0, Math.min(docs.length, idx + (dir === 'right' ? 1 : -1))),
          );
        } else {
          const topOrder: Array<'DEMO' | 'MANUAL' | 'GEAR'> = ['DEMO', 'MANUAL', 'GEAR'];
          const curIdx = topOrder.indexOf(menuFocusArea);
          const nextIdx = Math.max(
            0,
            Math.min(topOrder.length - 1, curIdx + (dir === 'right' ? 1 : -1)),
          );
          setMenuFocusArea(topOrder[nextIdx]);
        }
        return;
      }

      if (screen === 'MANUAL') {
        if (dir === 'down' || dir === 'right') {
          setManualSectionIndex(idx => Math.min(3, idx + 1));
        } else {
          setManualSectionIndex(idx => Math.max(0, idx - 1));
        }
        return;
      }

      if (screen === 'SETTINGS') {
        if (dir === 'up' || dir === 'down') {
          setSettingsRowIndex(r => (r === 0 ? 1 : 0));
          return;
        }
        if (dir === 'left' || dir === 'right') {
          if (settingsRowIndex === 0) {
            setSettings(s => ({
              ...s,
              themeMode: s.themeMode === 'transparent' ? 'light' : 'transparent',
            }));
          } else {
            setSettings(s => ({
              ...s,
              wristMappingMode:
                s.wristMappingMode === 'stretched-arm'
                  ? 'horizontal-surface'
                  : 'stretched-arm',
            }));
          }
        }
        return;
      }

      // screen === 'DOCUMENT'
      if (modeSelectorActive) {
        if (dir === 'left' || dir === 'right') {
          const nextIdx = Math.max(
            0,
            Math.min(DOC_MODES.length - 1, hoveredModeIndex + (dir === 'right' ? 1 : -1)),
          );
          hoveredModeIdxRef.current = nextIdx;
          setHoveredModeIndex(nextIdx);
        }
        return;
      }

      if (docMode === 'DRAW') {
        if (drawSubmenu === null) {
          if (dir === 'left' || dir === 'right') {
            setDrawTopIndex(i =>
              Math.max(0, Math.min(DRAW_TOP_ITEMS.length - 1, i + (dir === 'right' ? 1 : -1))),
            );
          }
          return;
        }
        const maxLen =
          drawSubmenu === 'thickness'
            ? LINE_THICKNESSES.length
            : drawSubmenu === 'color' || drawSubmenu === 'fill'
              ? TWENTY_COLORS.length
              : drawSubmenu === 'brush'
                ? BRUSH_TYPES.length
                : SHAPE_TYPES.length;
        const delta =
          dir === 'right'
            ? 1
            : dir === 'left'
              ? -1
              : (drawSubmenu === 'color' || drawSubmenu === 'fill') && dir === 'down'
                ? 10
                : (drawSubmenu === 'color' || drawSubmenu === 'fill') && dir === 'up'
                  ? -10
                  : 0;
        if (delta !== 0) {
          setDrawSubIndex(i => Math.max(0, Math.min(maxLen - 1, i + delta)));
        }
        return;
      }

      if (docMode === 'WRITE') {
        if (dir === 'up') {
          moveWriteLine(-1);
          return;
        }
        if (dir === 'down') {
          moveWriteLine(1);
          return;
        }
        if (writeSubmenu === null) {
          setWriteTopIndex(i =>
            Math.max(0, Math.min(WRITE_TOP_ITEMS.length - 1, i + (dir === 'right' ? 1 : -1))),
          );
          return;
        }
        const maxLen =
          writeSubmenu === 'style'
            ? WRITE_STYLE_OPTIONS.length
            : writeSubmenu === 'format'
              ? 3
              : writeSubmenu === 'size'
                ? FONT_SIZES.length
                : writeSubmenu === 'list'
                  ? WRITE_LIST_OPTIONS.length
                  : 1;
        setWriteSubIndex(i => Math.max(0, Math.min(maxLen - 1, i + (dir === 'right' ? 1 : -1))));
      }
    },
    [
      cardOptionsDocId,
      deleteConfirmDocId,
      docMode,
      docs.length,
      drawSubmenu,
      hoveredModeIndex,
      menuFocusArea,
      menuSelectedIndex,
      modeSelectorActive,
      moveWriteLine,
      screen,
      settingsRowIndex,
      writeSubmenu,
    ],
  );

  const handleTipSingleTap = useCallback(() => {
    if (screen === 'MENU') {
      if (deleteConfirmDocId) {
        if (deleteConfirmYes) {
          handleConfirmDeleteDoc(deleteConfirmDocId);
        } else {
          setDeleteConfirmDocId(null);
        }
        return;
      }
      if (cardOptionsDocId) {
        if (cardOptionIndex === 0) {
          handleTogglePinDoc(cardOptionsDocId);
        } else {
          setDeleteConfirmDocId(cardOptionsDocId);
          setDeleteConfirmYes(false);
        }
        return;
      }
      if (menuFocusArea === 'DEMO') {
        handleStartDemo();
        return;
      }
      if (menuFocusArea === 'MANUAL') {
        handleOpenManual();
        return;
      }
      if (menuFocusArea === 'GEAR') {
        handleOpenSettings();
        return;
      }
      if (menuSelectedIndex < docs.length) {
        openDocument(docs[menuSelectedIndex].id);
      } else {
        handleCreateNewDoc();
      }
      return;
    }

    if (screen === 'MANUAL') {
      handleBackToMenu();
      return;
    }

    if (screen === 'SETTINGS') {
      if (settingsRowIndex === 0) {
        setSettings(s => ({
          ...s,
          themeMode: s.themeMode === 'transparent' ? 'light' : 'transparent',
        }));
      } else {
        setSettings(s => ({
          ...s,
          wristMappingMode:
            s.wristMappingMode === 'stretched-arm'
              ? 'horizontal-surface'
              : 'stretched-arm',
        }));
      }
      return;
    }

    // screen === 'DOCUMENT'
    if (modeSelectorActive) {
      confirmHoveredMode();
      return;
    }

    if (docMode === 'DRAW') {
      if (drawSubmenu === null) {
        const chosen = DRAW_TOP_ITEMS[drawTopIndex];
        if (chosen) handleSelectDrawTop(drawTopIndex, chosen.id);
      } else {
        applyDrawSubOption(drawSubmenu, drawSubIndex);
      }
      return;
    }

    if (docMode === 'WRITE') {
      if (writeSubmenu === null) {
        const chosen = WRITE_TOP_ITEMS[writeTopIndex];
        if (chosen) handleSelectWriteTop(writeTopIndex, chosen.id);
      } else {
        applyWriteSubOption(writeSubmenu, writeSubIndex);
      }
    }
  }, [
    applyDrawSubOption,
    applyWriteSubOption,
    cardOptionIndex,
    cardOptionsDocId,
    confirmHoveredMode,
    deleteConfirmDocId,
    deleteConfirmYes,
    docMode,
    docs,
    drawSubIndex,
    drawSubmenu,
    drawTopIndex,
    handleBackToMenu,
    handleConfirmDeleteDoc,
    handleCreateNewDoc,
    handleOpenManual,
    handleOpenSettings,
    handleSelectDrawTop,
    handleSelectWriteTop,
    handleStartDemo,
    handleTogglePinDoc,
    menuFocusArea,
    menuSelectedIndex,
    modeSelectorActive,
    openDocument,
    screen,
    settingsRowIndex,
    writeSubIndex,
    writeSubmenu,
    writeTopIndex,
  ]);

  const handleTipDoubleTap = useCallback(() => {
    if (screen === 'DOCUMENT' && docMode === 'DRAW') {
      hoverOriginRef.current = penPosRef.current;
      sensorRef.current?.captureReference();
      showToast('Re-centered pen');
    }
  }, [docMode, screen, showToast]);

  const handleTipTripleTap = useCallback(() => {
    if (screen === 'DOCUMENT') {
      handleUndo();
    }
  }, [handleUndo, screen]);

  const handleTipHoldStart = useCallback(() => {
    if (screen === 'MENU') {
      if (
        !cardOptionsDocId &&
        !deleteConfirmDocId &&
        menuFocusArea === 'CARDS' &&
        menuSelectedIndex < docs.length
      ) {
        setCardOptionsDocId(docs[menuSelectedIndex].id);
        setCardOptionIndex(0);
        pushHistorySubstate();
      }
      return;
    }

    if (screen !== 'DOCUMENT') return;

    if (modeSelectorActive) {
      confirmHoveredMode();
      return;
    }

    sensorRef.current?.captureReference();

    if (docMode === 'DRAW') {
      drawOriginRef.current = penPosRef.current;
      if (drawToolRef.current === 'brush' && selectedBrushRef.current === 'eraser') {
        activeHoldRef.current = 'draw-erase';
        eraseUndoPushedRef.current = false;
        erasePrevPosRef.current = penPosRef.current;
        setIsErasing(true);
        return;
      }
      activeHoldRef.current = 'draw-paint';
      drawHoldStartedAtRef.current = performance.now();
      beginDrawOrShapeAt(penPosRef.current);
      return;
    }

    if (docMode === 'WRITE') {
      const doc = activeDocRef.current;
      if (!doc) return;
      activeHoldRef.current = 'write-scrub';
      writeScrubOriginCharRef.current = doc.cursor.charIndex;
      setIsCursorScrubbing(true);
    }
  }, [
    beginDrawOrShapeAt,
    cardOptionsDocId,
    confirmHoveredMode,
    deleteConfirmDocId,
    docMode,
    docs,
    menuFocusArea,
    menuSelectedIndex,
    modeSelectorActive,
    pushHistorySubstate,
    screen,
  ]);

  const handleTipHoldEnd = useCallback(() => {
    const hold = activeHoldRef.current;
    activeHoldRef.current = 'none';
    setIsCursorScrubbing(false);

    if (hold === 'draw-erase') {
      setIsErasing(false);
      eraseUndoPushedRef.current = false;
      hoverOriginRef.current = penPosRef.current;
      sensorRef.current?.clearReference();
      return;
    }

    if (hold === 'draw-paint') {
      const hadMovement =
        (activeStrokeRef.current?.points.length ?? 0) > 1 ||
        Boolean(
          activeShapeRef.current &&
            (Math.abs(activeShapeRef.current.x2 - activeShapeRef.current.x1) >= 4 ||
              Math.abs(activeShapeRef.current.y2 - activeShapeRef.current.y1) >= 4),
        );
      commitActiveInkOrShape();
      hoverOriginRef.current = penPosRef.current;
      sensorRef.current?.clearReference();
      if (!hadMovement && performance.now() - drawHoldStartedAtRef.current < 260) {
        // Ignore sub-threshold tap jitter
      }
    }
  }, [commitActiveInkOrShape]);

  const handleTipDoubleHoldStart = useCallback(() => {
    if (screen !== 'DOCUMENT') return;
    sensorRef.current?.captureReference();
    activeHoldRef.current = 'double-pending';
    holdLockOffsetRef.current = null;
    preSelectorModeRef.current = docModeRef.current;
    const idx = DOC_MODES.findIndex(m => m.id === docModeRef.current);
    hoveredModeIdxRef.current = idx >= 0 ? idx : 0;
    setHoveredModeIndex(hoveredModeIdxRef.current);
    zoomOriginRef.current = zoomRef.current;
    panOriginRef.current = panRef.current;
    drawOriginRef.current = penPosRef.current;
  }, [screen]);

  const handleTipDoubleHoldEnd = useCallback(() => {
    const hold = activeHoldRef.current;
    activeHoldRef.current = 'none';
    holdLockOffsetRef.current = null;

    if (hold === 'view-zoom' || hold === 'view-pan') {
      hoverOriginRef.current = penPosRef.current;
      sensorRef.current?.clearReference();
      return;
    }

    if (hold === 'mode-select') {
      // Keep hovered mode open for 1x Tap confirmation or Middle Finger cancellation
      sensorRef.current?.clearReference();
    }
  }, []);

  useWristbandControls({
    screen,
    docMode,
    isLiveWristSensor: sensorStatus === 'live',
    onSwipe: handleSwipe,
    onTipSingleTap: handleTipSingleTap,
    onTipDoubleTap: handleTipDoubleTap,
    onTipTripleTap: handleTipTripleTap,
    onTipHoldStart: handleTipHoldStart,
    onTipHoldEnd: handleTipHoldEnd,
    onTipDoubleHoldStart: handleTipDoubleHoldStart,
    onTipDoubleHoldEnd: handleTipDoubleHoldEnd,
    onMiddleFingerBack: handleMiddleFingerBack,
    onUndoShortcut: handleUndo,
    onGestureLog: () => {},
  });

  const handleSelectLine = useCallback(
    (lineIndex: number, charIndex?: number) => {
      updateActiveDocument(doc => {
        const clampedLine = Math.max(0, Math.min(doc.blocks.length - 1, lineIndex));
        const len = doc.blocks[clampedLine]?.text.length ?? 0;
        const nextChar =
          typeof charIndex === 'number' ? Math.max(0, Math.min(len, charIndex)) : len;
        return {
          ...doc,
          cursor: { lineIndex: clampedLine, charIndex: nextChar },
        };
      });
    },
    [updateActiveDocument],
  );

  const handleRecordRawInputEvent = useCallback((eventName: string, detail: string) => {
    setRawInputEvents(prev => [`${eventName}: ${detail}`, ...prev].slice(0, 6));
  }, []);

  const capabilityReport = useMemo<InputCapabilityReport>(() => {
    const base = readInputCapabilityBaseline(sensorStatus);
    return {
      ...base,
      lastRawEvents: rawInputEvents,
    };
  }, [rawInputEvents, sensorStatus]);

  const activeBlock = useMemo(() => {
    if (!activeDoc) return undefined;
    return activeDoc.blocks[activeDoc.cursor.lineIndex];
  }, [activeDoc]);

  return (
    <div
      className={`glasses-viewport-host ${
        settings.themeMode === 'light' ? 'is-theme-light' : 'is-theme-transparent'
      }`}
    >
      <main
        className={`glasses-stage ${
          screen === 'DOCUMENT' ? 'is-document-screen' : 'is-menu-screen'
        }`}
      >
        {demoPhase === 'COUNTDOWN' && (
          <div className="demo-blackout-stage" onClick={handleExitDemo}>
            {demoCountdownSec !== null && (
              <div className="demo-countdown-pill">{demoCountdownSec}</div>
            )}
          </div>
        )}

        {demoPhase === 'UI_OFF' && (
          <div
            className="demo-blackout-stage"
            onClick={handleExitDemo}
            title="Demo finished — click or press Escape to return to Menu"
          />
        )}

        {demoPhase === 'PHOTO_CAPTURE' && (
          <div className="demo-capture-stage">
            <img
              className="demo-capture-photo"
              src={PHOTO_BG_URL}
              alt="Captured scene"
              draggable={false}
            />
            <div className={`demo-open-aircraft-pill ${demoActionActive ? 'is-active' : ''}`}>
              Open with AirCraft
            </div>
            {demoFlashOpacity > 0 && (
              <div className="demo-camera-flash" style={{ opacity: demoFlashOpacity }} />
            )}
          </div>
        )}

        {(demoPhase === 'IDLE' || demoPhase === 'RUNNING_UI') &&
          (screen === 'MENU' || screen === 'SETTINGS' || screen === 'MANUAL') && (
            <MenuScreen
              screen={screen}
              docs={docs}
              settings={settings}
              menuFocusArea={menuFocusArea}
              menuSelectedIndex={menuSelectedIndex}
              cardOptionsDocId={cardOptionsDocId}
              cardOptionIndex={cardOptionIndex}
              deleteConfirmDocId={deleteConfirmDocId}
              deleteConfirmYes={deleteConfirmYes}
              settingsRowIndex={settingsRowIndex}
              manualSectionIndex={manualSectionIndex}
              onCloseCardOptions={() => setCardOptionsDocId(null)}
              onStartDemo={handleStartDemo}
              onOpenManual={handleOpenManual}
              onOpenSettings={handleOpenSettings}
              onSetThemeMode={themeMode => setSettings(s => ({ ...s, themeMode }))}
              onSetWristMappingMode={wristMappingMode =>
                setSettings(s => ({ ...s, wristMappingMode }))
              }
              onBackFromSettings={handleBackToMenu}
              onBackFromManual={handleBackToMenu}
            />
          )}

        {(demoPhase === 'IDLE' || demoPhase === 'RUNNING_UI') &&
          screen === 'DOCUMENT' &&
          activeDoc && (
          <>
            <DocumentCanvas
              doc={activeDoc}
              themeMode={settings.themeMode}
              mode={docMode}
              isWindowActive={!modeSelectorActive}
              zoom={zoom}
              panX={panX}
              panY={panY}
              activeStroke={activeStroke}
              activeShape={activeShape}
              penPos={penPos}
              penColor={selectedColor}
              penWidth={selectedThickness}
              rollDeg={scrubRollDeg}
              isErasing={
                isErasing ||
                (docMode === 'DRAW' && drawTool === 'brush' && selectedBrush === 'eraser')
              }
              isCursorScrubbing={isCursorScrubbing}
              onSelectLine={handleSelectLine}
              onViewportResize={handleViewportResize}
            />

            <DocumentToolbars
              mode={docMode}
              modeSelectorActive={modeSelectorActive}
              hoveredModeIndex={hoveredModeIndex}
              drawSubmenu={drawSubmenu}
              drawTopIndex={drawTopIndex}
              drawSubIndex={drawSubIndex}
              drawTool={drawTool}
              selectedThickness={selectedThickness}
              selectedColor={selectedColor}
              selectedFillColor={selectedFillColor}
              selectedBrush={selectedBrush}
              selectedShape={selectedShape}
              writeSubmenu={writeSubmenu}
              writeTopIndex={writeTopIndex}
              writeSubIndex={writeSubIndex}
              activeBlock={activeBlock}
              writerInputRef={writerInputRef}
              capabilityReport={capabilityReport}
              showProbe={showProbe}
              onSelectDrawTop={handleSelectDrawTop}
              onBackDrawSubmenu={() => setDrawSubmenu(null)}
              onPickThickness={(px, idx) => {
                setDrawSubIndex(idx);
                setSelectedThickness(px);
                showToast(`Thickness: ${px}px`);
              }}
              onPickColor={(hex, idx) => {
                setDrawSubIndex(idx);
                setSelectedColor(hex);
                const name = TWENTY_COLORS[idx]?.name ?? hex;
                showToast(`Color: ${name}`);
              }}
              onPickBrush={(brush, idx) => {
                setDrawSubIndex(idx);
                setSelectedBrush(brush);
                setDrawTool('brush');
                showToast(`Brush: ${brush}`);
              }}
              onPickShape={(shape, idx) => {
                setDrawSubIndex(idx);
                setSelectedShape(shape);
                setDrawTool('shape');
                showToast(`Shape: ${shape}`);
              }}
              onPickFillColor={(hex, idx) => {
                setDrawSubIndex(idx);
                setSelectedFillColor(hex);
                const name = TWENTY_COLORS[idx]?.name ?? hex;
                showToast(`Fill: ${name}`);
              }}
              onSelectWriteTop={handleSelectWriteTop}
              onBackWriteSubmenu={() => setWriteSubmenu(null)}
              onPickWriteStyle={applyWriteStyleOption}
              onToggleWriteFormat={toggleWriteFormatOption}
              onPickWriteSize={applyWriteSizeOption}
              onPickWriteList={applyWriteListOption}
              onToggleProbe={() => setShowProbe(v => !v)}
              onCommitText={handleCommitText}
              onNewLine={handleNewLine}
              onBackspace={handleBackspace}
              onUndo={handleUndo}
              onRecordRawInputEvent={handleRecordRawInputEvent}
            />
          </>
        )}

        {(demoPhase === 'IDLE' || demoPhase === 'RUNNING_UI') && toast && (
          <div className="glasses-toast">{toast}</div>
        )}
      </main>
    </div>
  );
}

export default App;
