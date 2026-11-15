import React, { useEffect, useRef } from 'react';
import {
  BRUSH_TYPES,
  type BlockKind,
  type BrushType,
  type DocBlock,
  type DocInteractionMode,
  type DrawSubmenu,
  FONT_SIZES,
  LINE_THICKNESSES,
  SHAPE_TYPES,
  type ShapeType,
  TWENTY_COLORS,
  type WriteSubmenu,
} from '../types/document';
import { type InputCapabilityReport, NeuralComposer } from './NeuralComposer';

export const DOC_MODES: readonly { id: DocInteractionMode; label: string }[] = [
  { id: 'VIEW', label: '🔍 View Mode' },
  { id: 'DRAW', label: '✏️ Drawing Mode' },
  { id: 'WRITE', label: '📝 Writing Mode' },
];

export const DRAW_TOP_ITEMS: readonly { id: Exclude<DrawSubmenu, null>; label: string }[] = [
  { id: 'thickness', label: 'Line thickness' },
  { id: 'color', label: 'Color' },
  { id: 'brush', label: 'Brush type' },
  { id: 'shape', label: 'Add Shape' },
  { id: 'fill', label: 'Fill color' },
];

export const WRITE_TOP_ITEMS: readonly { id: Exclude<WriteSubmenu, null>; label: string }[] = [
  { id: 'style', label: 'Text Style' },
  { id: 'format', label: 'Formatting' },
  { id: 'size', label: 'Size' },
  { id: 'list', label: 'Bullet Points' },
  { id: 'input', label: 'Glasses Input' },
];

export const WRITE_STYLE_OPTIONS: readonly { kind: BlockKind; label: string }[] = [
  { kind: 'h1', label: 'Headline 1' },
  { kind: 'h2', label: 'Headline 2' },
  { kind: 'h3', label: 'Subheadline' },
  { kind: 'p', label: 'Normal Text' },
  { kind: 'quote', label: 'Quote' },
];

export const WRITE_LIST_OPTIONS: readonly { kind: BlockKind; label: string }[] = [
  { kind: 'bullet', label: '• Bullet Points' },
  { kind: 'numbered', label: '1. Numbered List' },
  { kind: 'p', label: 'Normal Paragraph' },
];

interface DocumentToolbarsProps {
  mode: DocInteractionMode;
  modeSelectorActive: boolean;
  hoveredModeIndex: number;
  // Drawing state & hierarchy
  drawSubmenu: DrawSubmenu;
  drawTopIndex: number;
  drawSubIndex: number;
  drawTool: 'brush' | 'shape';
  selectedThickness: number;
  selectedColor: string;
  selectedFillColor: string;
  selectedBrush: BrushType;
  selectedShape: ShapeType;
  // Writing state & hierarchy
  writeSubmenu: WriteSubmenu;
  writeTopIndex: number;
  writeSubIndex: number;
  activeBlock: DocBlock | undefined;
  writerInputRef: React.RefObject<HTMLInputElement | null>;
  capabilityReport: InputCapabilityReport;
  showProbe: boolean;
  // Callbacks
  onSelectDrawTop: (idx: number, submenu: Exclude<DrawSubmenu, null>) => void;
  onBackDrawSubmenu: () => void;
  onPickThickness: (px: number, idx: number) => void;
  onPickColor: (hex: string, idx: number) => void;
  onPickBrush: (brush: BrushType, idx: number) => void;
  onPickShape: (shape: ShapeType, idx: number) => void;
  onPickFillColor: (hex: string, idx: number) => void;
  onSelectWriteTop: (idx: number, submenu: Exclude<WriteSubmenu, null>) => void;
  onBackWriteSubmenu: () => void;
  onPickWriteStyle: (kind: BlockKind, idx: number) => void;
  onToggleWriteFormat: (fmt: 'bold' | 'italic' | 'underline', idx: number) => void;
  onPickWriteSize: (pt: number, idx: number) => void;
  onPickWriteList: (kind: BlockKind, idx: number) => void;
  onToggleProbe: () => void;
  onCommitText: (text: string) => void;
  onNewLine: () => void;
  onBackspace: () => void;
  onUndo: () => void;
  onRecordRawInputEvent: (eventName: string, detail: string) => void;
}

export const DocumentToolbars: React.FC<DocumentToolbarsProps> = ({
  mode,
  modeSelectorActive,
  hoveredModeIndex,
  drawSubmenu,
  drawTopIndex,
  drawSubIndex,
  drawTool,
  selectedThickness,
  selectedColor,
  selectedFillColor,
  selectedBrush,
  selectedShape,
  writeSubmenu,
  writeTopIndex,
  writeSubIndex,
  activeBlock,
  writerInputRef,
  capabilityReport,
  showProbe,
  onSelectDrawTop,
  onBackDrawSubmenu,
  onPickThickness,
  onPickColor,
  onPickBrush,
  onPickShape,
  onPickFillColor,
  onSelectWriteTop,
  onBackWriteSubmenu,
  onPickWriteStyle,
  onToggleWriteFormat,
  onPickWriteSize,
  onPickWriteList,
  onToggleProbe,
  onCommitText,
  onNewLine,
  onBackspace,
  onUndo,
  onRecordRawInputEvent,
}) => {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeIdx =
      mode === 'DRAW'
        ? drawSubmenu === null
          ? drawTopIndex
          : drawSubIndex
        : mode === 'WRITE'
          ? writeSubmenu === null
            ? writeTopIndex
            : writeSubIndex
          : -1;
    if (activeIdx >= 0) {
      const btn = itemRefs.current[activeIdx];
      if (btn && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    }
  }, [mode, drawSubmenu, drawTopIndex, drawSubIndex, writeSubmenu, writeTopIndex, writeSubIndex]);

  const brushLabel = BRUSH_TYPES.find(b => b.id === selectedBrush)?.label ?? selectedBrush;
  const shapeLabel = SHAPE_TYPES.find(s => s.id === selectedShape)?.label ?? selectedShape;

  return (
    <section className="doc-bottom-chrome" aria-label="Mode Toolbar and Mode Switcher">
      {/* Drawing Mode Unfolded Tree Toolbar */}
      {mode === 'DRAW' && (
        <div className="tree-toolbar-dock is-draw" aria-label="Drawing toolbar">
          {drawSubmenu === null ? (
            <div className="tree-toolbar-row">
              {DRAW_TOP_ITEMS.map((item, idx) => (
                <button
                  key={item.id}
                  ref={el => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  tabIndex={-1}
                  className={`tree-pill ${drawTopIndex === idx ? 'is-selected' : ''} ${
                    (item.id === 'brush' && drawTool === 'brush') ||
                    (item.id === 'shape' && drawTool === 'shape')
                      ? 'is-active-tool'
                      : ''
                  }`}
                  onClick={() => onSelectDrawTop(idx, item.id)}
                >
                  {item.id === 'color' && (
                    <span className="swatch-dot" style={{ backgroundColor: selectedColor }} />
                  )}
                  {item.id === 'fill' && (
                    <span className="swatch-dot" style={{ backgroundColor: selectedFillColor }} />
                  )}
                  <span>
                    {item.id === 'thickness'
                      ? `Line thickness (${selectedThickness}px)`
                      : item.id === 'brush'
                        ? `Brush: ${brushLabel}`
                        : item.id === 'shape'
                          ? drawTool === 'shape'
                            ? `Shape: ${shapeLabel}`
                            : 'Add Shape'
                          : item.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="tree-toolbar-subview">
              <button
                type="button"
                tabIndex={-1}
                className="tree-back-chip"
                onClick={onBackDrawSubmenu}
                title="Back to Drawing menu (Middle Finger)"
              >
                ← {DRAW_TOP_ITEMS.find(i => i.id === drawSubmenu)?.label}
              </button>

              <div className="tree-toolbar-row">
                {drawSubmenu === 'thickness' &&
                  LINE_THICKNESSES.map((px, idx) => (
                    <button
                      key={px}
                      ref={el => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      className={`tree-pill ${drawSubIndex === idx ? 'is-selected' : ''} ${
                        selectedThickness === px ? 'is-current-value' : ''
                      }`}
                      onClick={() => onPickThickness(px, idx)}
                    >
                      <span
                        className="thickness-preview"
                        style={{ height: Math.min(12, Math.max(2, px)), width: 16 }}
                      />
                      <span>{px}px</span>
                    </button>
                  ))}

                {drawSubmenu === 'color' &&
                  TWENTY_COLORS.map((c, idx) => (
                    <button
                      key={c.name}
                      ref={el => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      className={`color-swatch-pill ${drawSubIndex === idx ? 'is-selected' : ''} ${
                        selectedColor === c.hex ? 'is-current-value' : ''
                      }`}
                      onClick={() => onPickColor(c.hex, idx)}
                      title={c.name}
                    >
                      <span className="swatch-dot-lg" style={{ backgroundColor: c.hex }} />
                      <span className="swatch-name">{c.name}</span>
                    </button>
                  ))}

                {drawSubmenu === 'brush' &&
                  BRUSH_TYPES.map((b, idx) => (
                    <button
                      key={b.id}
                      ref={el => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      className={`tree-pill ${drawSubIndex === idx ? 'is-selected' : ''} ${
                        drawTool === 'brush' && selectedBrush === b.id ? 'is-current-value' : ''
                      }`}
                      onClick={() => onPickBrush(b.id, idx)}
                    >
                      {b.label}
                    </button>
                  ))}

                {drawSubmenu === 'shape' &&
                  SHAPE_TYPES.map((s, idx) => (
                    <button
                      key={s.id}
                      ref={el => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      className={`tree-pill ${drawSubIndex === idx ? 'is-selected' : ''} ${
                        drawTool === 'shape' && selectedShape === s.id ? 'is-current-value' : ''
                      }`}
                      onClick={() => onPickShape(s.id, idx)}
                    >
                      {s.label}
                    </button>
                  ))}

                {drawSubmenu === 'fill' &&
                  TWENTY_COLORS.map((c, idx) => (
                    <button
                      key={c.name}
                      ref={el => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      className={`color-swatch-pill ${drawSubIndex === idx ? 'is-selected' : ''} ${
                        selectedFillColor === c.hex ? 'is-current-value' : ''
                      }`}
                      onClick={() => onPickFillColor(c.hex, idx)}
                      title={c.name}
                    >
                      <span className="swatch-dot-lg" style={{ backgroundColor: c.hex }} />
                      <span className="swatch-name">{c.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Writing Mode Unfolded Tree Toolbar */}
      {mode === 'WRITE' && (
        <div className="tree-toolbar-dock is-write" aria-label="Writing toolbar">
          {writeSubmenu === null ? (
            <div className="tree-toolbar-row">
              {WRITE_TOP_ITEMS.map((item, idx) => (
                <button
                  key={item.id}
                  ref={el => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  tabIndex={-1}
                  className={`tree-pill ${writeTopIndex === idx ? 'is-selected' : ''}`}
                  onClick={() => onSelectWriteTop(idx, item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="tree-toolbar-subview is-column-if-input">
              <div className="subview-row-flex">
                <button
                  type="button"
                  tabIndex={-1}
                  className="tree-back-chip"
                  onClick={onBackWriteSubmenu}
                  title="Back to Writing menu (Middle Finger)"
                >
                  ← {WRITE_TOP_ITEMS.find(i => i.id === writeSubmenu)?.label}
                </button>

                {writeSubmenu === 'style' && (
                  <div className="tree-toolbar-row">
                    {WRITE_STYLE_OPTIONS.map((st, idx) => (
                      <button
                        key={st.kind}
                        ref={el => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        tabIndex={-1}
                        className={`tree-pill ${writeSubIndex === idx ? 'is-selected' : ''} ${
                          activeBlock?.kind === st.kind ? 'is-current-value' : ''
                        }`}
                        onClick={() => onPickWriteStyle(st.kind, idx)}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                )}

                {writeSubmenu === 'format' && (
                  <div className="tree-toolbar-row">
                    {(['bold', 'italic', 'underline'] as const).map((fmt, idx) => (
                      <button
                        key={fmt}
                        ref={el => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        tabIndex={-1}
                        className={`tree-pill ${writeSubIndex === idx ? 'is-selected' : ''} ${
                          activeBlock?.[fmt] ? 'is-current-value' : ''
                        }`}
                        onClick={() => onToggleWriteFormat(fmt, idx)}
                      >
                        {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                        {activeBlock?.[fmt] ? ' ✓' : ''}
                      </button>
                    ))}
                  </div>
                )}

                {writeSubmenu === 'size' && (
                  <div className="tree-toolbar-row">
                    {FONT_SIZES.map((pt, idx) => (
                      <button
                        key={pt}
                        ref={el => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        tabIndex={-1}
                        className={`tree-pill ${writeSubIndex === idx ? 'is-selected' : ''} ${
                          (activeBlock?.fontSize ?? 15) === pt ? 'is-current-value' : ''
                        }`}
                        onClick={() => onPickWriteSize(pt, idx)}
                      >
                        {pt}pt
                      </button>
                    ))}
                  </div>
                )}

                {writeSubmenu === 'list' && (
                  <div className="tree-toolbar-row">
                    {WRITE_LIST_OPTIONS.map((opt, idx) => (
                      <button
                        key={opt.label}
                        ref={el => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        tabIndex={-1}
                        className={`tree-pill ${writeSubIndex === idx ? 'is-selected' : ''} ${
                          activeBlock?.kind === opt.kind ? 'is-current-value' : ''
                        }`}
                        onClick={() => onPickWriteList(opt.kind, idx)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {writeSubmenu === 'input' && (
                <NeuralComposer
                  inputRef={writerInputRef}
                  capabilityReport={capabilityReport}
                  showProbe={showProbe}
                  onToggleProbe={onToggleProbe}
                  onCommitText={onCommitText}
                  onNewLine={onNewLine}
                  onBackspace={onBackspace}
                  onUndo={onUndo}
                  onRecordRawInputEvent={onRecordRawInputEvent}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode Switcher Banner when 2x Tap Hold + Rotate is active */}
      {modeSelectorActive && (
        <div className="mode-selector-banner" role="status" aria-live="polite">
          Mode Hover: Rotate Arm ◀▶ · <strong>1x Tip Confirm</strong> · Middle Finger Cancel
        </div>
      )}

      {/* Always-Visible Bottom Mode Bar */}
      <nav
        className={`doc-mode-bar ${modeSelectorActive ? 'is-selecting-mode is-window-active' : ''}`}
        aria-label="Document Modes"
      >
        {DOC_MODES.map((m, idx) => {
          const isCurrent = mode === m.id;
          const isHovered = modeSelectorActive && hoveredModeIndex === idx;
          return (
            <button
              key={m.id}
              type="button"
              tabIndex={-1}
              className={`doc-mode-pill ${isCurrent ? 'is-active' : ''} ${
                isHovered ? 'is-mode-hovered' : ''
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </nav>
    </section>
  );
};
