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
  type InkStroke,
  type ShapeType,
  type WristTelemetry,
  type WriteSubmenu,
} from './types/document';

const DOCS_STORAGE_KEY = 'neuraldoc-meta-a4-v2';
const SETTINGS_STORAGE_KEY = 'neuraldoc-meta-settings-v2';

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

const INITIAL_TELEMETRY: WristTelemetry = {
  status: 'checking',
  rawWFirst: null,
  w3cQuat: null,
  pointing: null,
  deltaPointing: null,
  rollDeg: 0,
  timestamp: 0,
  isSimulating: false,
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

function createSeedDocuments(): A4Document[] {
  const now = Date.now();
  return [
    {
      id: 'doc-1',
      docNumber: 1,
      title: 'Document 1',
      pinned: false,
      updatedAt: now,
      cursor: { lineIndex: 0, charIndex: 0 },
      blocks: [
        {
          id: 'blk-1',
          kind: 'h1',
          text: 'Document 1 — A4 Workspace',
          bold: true,
          fontSize: 22,
        },
        {
          id: 'blk-2',
          kind: 'p',
          text: '2x Hold + Rotate switches Drawing and Writing modes.',
          fontSize: 15,
        },
        {
          id: 'blk-3',
          kind: 'bullet',
          text: '2x Hold + Move zooms and drags the sheet across modes.',
          fontSize: 15,
        },
        {
          id: 'blk-4',
          kind: 'bullet',
          text: 'Middle Finger Back steps up toolbars or returns to Menu.',
          fontSize: 15,
        },
      ],
      strokes: [],
      shapes: [],
    },
  ];
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
    return valid.length > 0 ? sortDocsWithPinnedFirst(valid) : createSeedDocuments();
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

function getPanBoundsForZoom(zoom: number): { maxPanX: number; maxPanY: number } {
  const sheetEl = document.getElementById('document-sheet');
  const rect = sheetEl?.getBoundingClientRect();
  const viewW = rect && rect.width > 10 ? rect.width : 540;
  const viewH = rect && rect.height > 10 ? rect.height : 360;
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

function clampPanToZoom(panX: number, panY: number, zoom: number): { panX: number; panY: number } {
  const { maxPanX, maxPanY } = getPanBoundsForZoom(zoom);
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

export function App() {
  const [docs, setDocs] = useState<A4Document[]>(loadSavedDocuments);
  const [settings, setSettings] = useState<AppSettings>(loadSavedSettings);
  const [screen, setScreen] = useState<AppScreen>('MENU');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Explorer Menu & Settings state
  const [menuFocusArea, setMenuFocusArea] = useState<'CARDS' | 'GEAR'>('CARDS');
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);
  const [cardOptionsDocId, setCardOptionsDocId] = useState<string | null>(null);
  const [cardOptionIndex, setCardOptionIndex] = useState<0 | 1>(0);
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState<string | null>(null);
  const [deleteConfirmYes, setDeleteConfirmYes] = useState(false);
  const [settingsRowIndex, setSettingsRowIndex] = useState<0 | 1>(0);

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

  // Telemetry & toast state
  const [telemetry, setTelemetry] = useState<WristTelemetry>(INITIAL_TELEMETRY);
  const [toast, setToast] = useState<string | null>(null);

  // Refs for sensor loops & gesture disambiguation
  const writerInputRef = useRef<HTMLInputElement | null>(null);
  const sensorRef = useRef<WristSensorController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const undoMapRef = useRef<Map<string, DocumentHistorySnapshot[]>>(new Map());

  const activeHoldRef = useRef<
    | 'none'
    | 'view-zoom-pan'
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

  // Persist docs & settings
  useEffect(() => {
    try {
      localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(docs));
    } catch {
      // Ignore quota exceeded errors
    }
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

  // Initialize WristSensorController once
  useEffect(() => {
    const controller = new WristSensorController({
      initialMappingMode: settings.wristMappingMode,
      onReading: t => {
        setTelemetry(t);
        if (!t.deltaPointing || screenRef.current !== 'DOCUMENT') return;

        const { dx, dy, dz } = t.deltaPointing;
        const deltaPxX = dx * POINTER_SCALE;
        const deltaPxY = dy * POINTER_SCALE;
        const deltaPxZ = dz * POINTER_SCALE;
        const pointingPx = Math.hypot(deltaPxX, deltaPxY, deltaPxZ);
        const absRoll = Math.abs(t.rollDeg);

        // 1. Disambiguate 2x Hold between Mode Selector (forearm roll) and Integrated View Mode (zoom + drag)
        if (activeHoldRef.current === 'double-pending') {
          if (absRoll >= 5.0 && Math.hypot(deltaPxX, deltaPxY) < 14) {
            activeHoldRef.current = 'mode-select';
            setModeSelectorActive(true);
          } else if (pointingPx >= 8) {
            activeHoldRef.current = 'view-zoom-pan';
          } else {
            return;
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

        // 3. Integrated View Mode (available across both DRAW and WRITE via 2x Tap Hold + Move)
        if (activeHoldRef.current === 'view-zoom-pan') {
          // Moving wristband up (-deltaPxY > 0) zooms in; moving down (-deltaPxY < 0) zooms out
          const zoomDelta = (-deltaPxY) / 140;
          const nextZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, zoomOriginRef.current + zoomDelta),
          );
          // Moving wristband right (deltaPxX > 0) drags document left (-panX); left drags right (+panX)
          // Moving wristband away/front (deltaPxZ > 0) drags document down (+panY); back drags up (-panY)
          const rawPanX = panOriginRef.current.panX - deltaPxX * 1.15;
          const rawPanY = panOriginRef.current.panY + deltaPxZ * 1.25;
          const clamped = clampPanToZoom(rawPanX, rawPanY, nextZoom);
          setZoom(nextZoom);
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
            setPenPos(smoothed);
          }
          return;
        }

        // 5. WRITE MODE: 1x Hold + Rotate Arm scrubs character cursor along line
        if (mode === 'WRITE' && hold === 'write-scrub') {
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
      if (menuFocusArea === 'GEAR') {
        setMenuFocusArea('CARDS');
      }
      return;
    }

    if (screen === 'SETTINGS') {
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
              setMenuFocusArea('GEAR');
            }
          }
          return;
        }
        if (dir === 'down') {
          if (menuFocusArea === 'GEAR') {
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
      if (menuFocusArea === 'GEAR') {
        setScreen('SETTINGS');
        setSettingsRowIndex(0);
        pushHistorySubstate();
        return;
      }
      if (menuSelectedIndex < docs.length) {
        openDocument(docs[menuSelectedIndex].id);
      } else {
        handleCreateNewDoc();
      }
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
    handleConfirmDeleteDoc,
    handleCreateNewDoc,
    handleSelectDrawTop,
    handleSelectWriteTop,
    handleTogglePinDoc,
    menuFocusArea,
    menuSelectedIndex,
    modeSelectorActive,
    openDocument,
    pushHistorySubstate,
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

    if (hold === 'view-zoom-pan') {
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
    isLiveWristSensor: telemetry.status === 'live',
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
    const base = readInputCapabilityBaseline(telemetry.status);
    return {
      ...base,
      lastRawEvents: rawInputEvents,
    };
  }, [rawInputEvents, telemetry.status]);

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
        {(screen === 'MENU' || screen === 'SETTINGS') && (
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
            onCloseCardOptions={() => setCardOptionsDocId(null)}
            onSetThemeMode={themeMode => setSettings(s => ({ ...s, themeMode }))}
            onSetWristMappingMode={wristMappingMode =>
              setSettings(s => ({ ...s, wristMappingMode }))
            }
            onBackFromSettings={() => setScreen('MENU')}
          />
        )}

        {screen === 'DOCUMENT' && activeDoc && (
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
              rollDeg={telemetry.rollDeg}
              isErasing={
                isErasing ||
                (docMode === 'DRAW' && drawTool === 'brush' && selectedBrush === 'eraser')
              }
              isCursorScrubbing={isCursorScrubbing}
              onSelectLine={handleSelectLine}
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

        {toast && <div className="glasses-toast">{toast}</div>}
      </main>
    </div>
  );
}

export default App;
