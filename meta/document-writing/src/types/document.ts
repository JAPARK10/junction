export const A4_WIDTH = 560;
export const A4_HEIGHT = 792;

export type AppScreen = 'MENU' | 'SETTINGS' | 'DOCUMENT';
export type ThemeMode = 'transparent' | 'light';
export type WristMappingMode = 'stretched-arm' | 'horizontal-surface';
export type DocInteractionMode = 'VIEW' | 'DRAW' | 'WRITE';

export type BrushType = 'pen' | 'brush' | 'spray' | 'fill';
export type ShapeType = 'circle' | 'rectangle' | 'triangle' | 'arrow';
export type BlockKind = 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'quote';

export interface DocBlock {
  id: string;
  kind: BlockKind;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
}

export interface CursorPosition {
  lineIndex: number;
  charIndex: number;
}

export interface InkPoint {
  x: number;
  y: number;
  width: number;
}

export interface InkStroke {
  id: string;
  color: string;
  fillColor?: string;
  baseWidth: number;
  brushType: BrushType;
  points: InkPoint[];
}

export interface DocShape {
  id: string;
  kind: ShapeType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}

export interface A4Document {
  id: string;
  docNumber: number;
  title: string;
  pinned: boolean;
  updatedAt: number;
  blocks: DocBlock[];
  strokes: InkStroke[];
  shapes: DocShape[];
  cursor: CursorPosition;
}

export interface AppSettings {
  themeMode: ThemeMode;
  wristMappingMode: WristMappingMode;
}

export type DrawSubmenu = 'thickness' | 'color' | 'brush' | 'shape' | 'fill' | null;
export type WriteSubmenu = 'style' | 'format' | 'size' | 'list' | 'input' | null;

export const LINE_THICKNESSES = [2, 4, 7, 11, 16] as const;

export const TWENTY_COLORS: readonly { name: string; hex: string }[] = [
  { name: 'Black', hex: '#111827' },
  { name: 'Charcoal', hex: '#475569' },
  { name: 'Silver', hex: '#94a3b8' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#9333ea' },
  { name: 'Magenta', hex: '#db2777' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Coral', hex: '#fb7185' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Gold', hex: '#eab308' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Teal', hex: '#14b8a6' },
];

export const BRUSH_TYPES: readonly { id: BrushType; label: string }[] = [
  { id: 'pen', label: 'Standard Pen' },
  { id: 'brush', label: 'Brush' },
  { id: 'spray', label: 'Spray Paint' },
  { id: 'fill', label: 'Fill Color' },
];

export const SHAPE_TYPES: readonly { id: ShapeType; label: string }[] = [
  { id: 'circle', label: 'Circle' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'arrow', label: 'Arrow' },
];

export const FONT_SIZES = [12, 15, 18, 22, 28] as const;

export type SensorStatus =
  | 'checking'
  | 'live'
  | 'not-worn'
  | 'permission-denied'
  | 'unavailable-sim';

export interface WristTelemetry {
  status: SensorStatus;
  rawWFirst: [number, number, number, number] | null;
  w3cQuat: [number, number, number, number] | null;
  pointing: [number, number, number] | null;
  deltaPointing: { dx: number; dy: number } | null;
  rollDeg: number;
  timestamp: number;
  isSimulating: boolean;
}

export interface GestureEventRecord {
  id: string;
  label: string;
  detail: string;
  time: string;
}
