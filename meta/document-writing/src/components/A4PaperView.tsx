import React from 'react';
import {
  A4_HEIGHT,
  A4_WIDTH,
  type A4Document,
  type DocInteractionMode,
  type DocShape,
  type InkPoint,
  type InkStroke,
  type ThemeMode,
} from '../types/document';

interface A4PaperViewProps {
  doc: A4Document;
  paperTheme: ThemeMode;
  mode?: DocInteractionMode;
  isThumbnail?: boolean;
  activeStroke?: InkStroke | null;
  activeShape?: DocShape | null;
  penPos?: { x: number; y: number };
  penColor?: string;
  penWidth?: number;
  rollDeg?: number;
  isErasing?: boolean;
  isCursorScrubbing?: boolean;
  showCursor?: boolean;
  onSelectLine?: (lineIndex: number, charIndex?: number) => void;
}

function buildSmoothSvgPath(points: InkPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.3).toFixed(1)} ${(p.y + 0.3).toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (curr.x + next.x) * 0.5;
    const midY = (curr.y + next.y) * 0.5;
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function renderStrokeElement(
  stroke: InkStroke,
  key: string,
  isThumbnail = false,
): React.ReactNode {
  const pathData = buildSmoothSvgPath(stroke.points);
  if (!pathData) return null;

  if (stroke.brushType === 'brush') {
    return (
      <g key={key}>
        <path
          d={pathData}
          fill="none"
          stroke={stroke.color}
          strokeOpacity={0.35}
          strokeWidth={stroke.baseWidth * 1.85}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathData}
          fill="none"
          stroke={stroke.color}
          strokeOpacity={0.92}
          strokeWidth={stroke.baseWidth * 0.95}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  if (stroke.brushType === 'spray') {
    const radius = Math.max(4, stroke.baseWidth * 1.9);
    const step = isThumbnail
      ? Math.max(3, Math.ceil(stroke.points.length / 25))
      : stroke.points.length > 80
        ? 2
        : 1;
    const dots: React.ReactNode[] = [];
    for (let i = 0; i < stroke.points.length; i += step) {
      const pt = stroke.points[i];
      for (let k = 0; k < 4; k += 1) {
        const seed = (i + 1) * 19 + (k + 1) * 37;
        const angle = ((seed * 137.5) % 360) * (Math.PI / 180);
        const dist = (((seed * 29) % 100) / 100) * radius;
        const cx = pt.x + Math.cos(angle) * dist;
        const cy = pt.y + Math.sin(angle) * dist;
        const r = Math.max(0.8, stroke.baseWidth * 0.18);
        dots.push(
          <circle
            key={`${key}-d-${i}-${k}`}
            cx={cx}
            cy={cy}
            r={r}
            fill={stroke.color}
            fillOpacity={0.65}
          />,
        );
      }
    }
    return <g key={key}>{dots}</g>;
  }

  if (stroke.brushType === 'fill') {
    return (
      <path
        key={key}
        d={`${pathData} Z`}
        fill={stroke.fillColor ?? stroke.color}
        fillOpacity={0.4}
        stroke={stroke.color}
        strokeWidth={stroke.baseWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  return (
    <path
      key={key}
      d={pathData}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.baseWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function renderShapeElement(shape: DocShape, key: string, isPreview = false): React.ReactNode {
  const minX = Math.min(shape.x1, shape.x2);
  const maxX = Math.max(shape.x1, shape.x2);
  const minY = Math.min(shape.y1, shape.y2);
  const maxY = Math.max(shape.y1, shape.y2);
  const w = Math.max(2, maxX - minX);
  const h = Math.max(2, maxY - minY);
  const commonProps = {
    fill: 'none',
    stroke: shape.color,
    strokeWidth: shape.strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeDasharray: isPreview ? '6 4' : undefined,
  };

  if (shape.kind === 'rectangle') {
    return <rect key={key} x={minX} y={minY} width={w} height={h} {...commonProps} />;
  }

  if (shape.kind === 'circle') {
    return (
      <ellipse
        key={key}
        cx={(minX + maxX) * 0.5}
        cy={(minY + maxY) * 0.5}
        rx={w * 0.5}
        ry={h * 0.5}
        {...commonProps}
      />
    );
  }

  if (shape.kind === 'triangle') {
    const p1 = `${((minX + maxX) * 0.5).toFixed(1)},${minY.toFixed(1)}`;
    const p2 = `${minX.toFixed(1)},${maxY.toFixed(1)}`;
    const p3 = `${maxX.toFixed(1)},${maxY.toFixed(1)}`;
    return <polygon key={key} points={`${p1} ${p2} ${p3}`} {...commonProps} />;
  }

  // 'arrow'
  const dx = shape.x2 - shape.x1;
  const dy = shape.y2 - shape.y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const headLen = Math.min(len * 0.45, Math.max(12, shape.strokeWidth * 3));
  const angle = Math.PI / 6;
  const ax1 = shape.x2 - headLen * (ux * Math.cos(angle) - uy * Math.sin(angle));
  const ay1 = shape.y2 - headLen * (uy * Math.cos(angle) + ux * Math.sin(angle));
  const ax2 = shape.x2 - headLen * (ux * Math.cos(-angle) - uy * Math.sin(-angle));
  const ay2 = shape.y2 - headLen * (uy * Math.cos(-angle) + ux * Math.sin(-angle));

  return (
    <g key={key}>
      <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...commonProps} />
      <polyline
        points={`${ax1.toFixed(1)},${ay1.toFixed(1)} ${shape.x2.toFixed(1)},${shape.y2.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}`}
        {...commonProps}
      />
    </g>
  );
}

export const A4PaperView: React.FC<A4PaperViewProps> = React.memo(({
  doc,
  paperTheme,
  mode = 'DRAW',
  isThumbnail = false,
  activeStroke = null,
  activeShape = null,
  penPos = { x: A4_WIDTH * 0.5, y: A4_HEIGHT * 0.35 },
  penColor = '#06b6d4',
  penWidth = 4,
  rollDeg = 0,
  isErasing = false,
  isCursorScrubbing = false,
  showCursor = false,
  onSelectLine,
}) => {
  const allStrokes = activeStroke ? [...doc.strokes, activeStroke] : doc.strokes;
  const isLightPaper = paperTheme === 'light' || isThumbnail;

  let numberedCounter = 0;

  return (
    <div
      className={`a4-paper-root ${isLightPaper ? 'is-light-paper' : 'is-transparent-paper'} ${
        doc.backgroundImage ? 'has-bg-photo' : ''
      } ${isThumbnail ? 'is-thumbnail' : ''}`}
      style={{ width: A4_WIDTH, height: A4_HEIGHT }}
    >
      {doc.backgroundImage && (
        <img
          className="a4-bg-photo"
          src={doc.backgroundImage}
          alt=""
          draggable={false}
        />
      )}

      {/* Header inside A4 page */}
      <div className="a4-page-header">
        <span className="a4-doc-num">DOC #{doc.docNumber}</span>
        <span className="a4-doc-title">{doc.title}</span>
      </div>

      {/* Document Text Blocks */}
      <div className="a4-blocks-list">
        {doc.blocks.map((block, index) => {
          const isActiveLine = showCursor && index === doc.cursor.lineIndex;
          const clampedCol = Math.max(0, Math.min(block.text.length, doc.cursor.charIndex));
          const before = block.text.slice(0, clampedCol);
          const after = block.text.slice(clampedCol);

          if (block.kind === 'numbered') {
            numberedCounter += 1;
          } else {
            numberedCounter = 0;
          }

          const classes = [
            'a4-block-text',
            `a4-kind-${block.kind}`,
            block.bold ? 'is-bold' : '',
            block.italic ? 'is-italic' : '',
            block.underline ? 'is-underline' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={block.id}
              className={`a4-line ${isActiveLine ? 'is-active-line' : ''}`}
              onClick={
                !isThumbnail && onSelectLine
                  ? e => {
                      e.stopPropagation();
                      onSelectLine(index, block.text.length);
                    }
                  : undefined
              }
            >
              <div
                className={classes}
                style={block.fontSize ? { fontSize: `${block.fontSize}px` } : undefined}
              >
                {block.kind === 'bullet' && (
                  <span className="a4-list-marker" aria-hidden="true">
                    •
                  </span>
                )}
                {block.kind === 'numbered' && (
                  <span className="a4-list-marker" aria-hidden="true">
                    {numberedCounter}.
                  </span>
                )}
                <span className="a4-text-run">
                  {isActiveLine ? (
                    <>
                      <span>{before}</span>
                      <span
                        className={`a4-cursor-caret ${mode === 'WRITE' ? 'is-writing' : ''}`}
                      />
                      {isCursorScrubbing && (
                        <span className="a4-cursor-scrub-pill">
                          ◀ Col {clampedCol + 1} ▶ ({rollDeg > 0 ? `+${rollDeg}` : rollDeg}°)
                        </span>
                      )}
                      <span>{after}</span>
                      {block.text.length === 0 && (
                        <span className="a4-empty-hint">Empty line — open Glasses Input to write</span>
                      )}
                    </>
                  ) : (
                    <span>{block.text || '\u00A0'}</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SVG Ink Strokes, Shapes & Continuous Draw Crosshair Layer */}
      <svg
        className="a4-svg-overlay"
        viewBox={`0 0 ${A4_WIDTH} ${A4_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {allStrokes.map(stroke => renderStrokeElement(stroke, stroke.id, isThumbnail))}
        {doc.shapes.map(shape => renderShapeElement(shape, shape.id, false))}
        {activeShape && renderShapeElement(activeShape, `${activeShape.id}-preview`, true)}

        {!isThumbnail && mode === 'DRAW' && (
          <g transform={`translate(${penPos.x}, ${penPos.y})`}>
            {isErasing ? (
              <>
                <circle
                  r={16}
                  fill="rgba(255, 59, 92, 0.16)"
                  stroke="#ff3b5c"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
                <line x1={-6} y1={-6} x2={6} y2={6} stroke="#ff3b5c" strokeWidth={2} />
                <line x1={-6} y1={6} x2={6} y2={-6} stroke="#ff3b5c" strokeWidth={2} />
              </>
            ) : (
              <>
                <circle
                  r={Math.max(4, penWidth * 0.55)}
                  fill="none"
                  stroke={penColor}
                  strokeWidth={1.8}
                />
                <circle r={2} fill={penColor} />
                <line x1={-12} y1={0} x2={-5} y2={0} stroke={penColor} strokeWidth={1.5} />
                <line x1={5} y1={0} x2={12} y2={0} stroke={penColor} strokeWidth={1.5} />
                <line x1={0} y1={-12} x2={0} y2={-5} stroke={penColor} strokeWidth={1.5} />
                <line x1={0} y1={5} x2={0} y2={12} stroke={penColor} strokeWidth={1.5} />
              </>
            )}
          </g>
        )}
      </svg>
    </div>
  );
});
