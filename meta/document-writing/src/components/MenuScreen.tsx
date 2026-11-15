import React, { useEffect, useRef } from 'react';
import {
  A4_HEIGHT,
  A4_WIDTH,
  type A4Document,
  type AppSettings,
  type ThemeMode,
  type WristMappingMode,
} from '../types/document';
import { A4PaperView } from './A4PaperView';

const CARD_THUMB_W = 104;
const CARD_THUMB_H = Math.round((CARD_THUMB_W * A4_HEIGHT) / A4_WIDTH);

interface MenuScreenProps {
  screen: 'MENU' | 'SETTINGS' | 'MANUAL';
  docs: A4Document[];
  settings: AppSettings;
  menuFocusArea: 'CARDS' | 'DEMO' | 'MANUAL' | 'GEAR';
  menuSelectedIndex: number;
  cardOptionsDocId: string | null;
  cardOptionIndex: 0 | 1; // 0 = Pin, 1 = Delete
  deleteConfirmDocId: string | null;
  deleteConfirmYes: boolean;
  settingsRowIndex: 0 | 1;
  manualSectionIndex: number;
  onCloseCardOptions: () => void;
  onStartDemo: () => void;
  onOpenManual: () => void;
  onOpenSettings: () => void;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSetWristMappingMode: (mode: WristMappingMode) => void;
  onBackFromSettings: () => void;
  onBackFromManual: () => void;
}

const MANUAL_SECTIONS: ReadonlyArray<{ title: string; items: ReadonlyArray<[string, string]> }> = [
  {
    title: '1. Explorer Menu, Photo Repo & Cards',
    items: [
      ['Swipe Left / Right / Up / Down', 'Move across A4 documents and synced account photos.'],
      ['Swipe Up (top row)', 'Focus top-right Manual (📖) and Settings (⚙️) icons; Swipe Left/Right to switch.'],
      ['1x Index Tap', 'Open document/photo, create sheet on + New Document, or open Manual / Settings.'],
      ['1x Index Hold (on card)', 'Open Pin / Unpin and Delete actions (Middle Finger closes).'],
    ],
  },
  {
    title: '2. Mode Switching, Zoom & Pan',
    items: [
      ['2x Tap Hold + Rotate Left / Right (at 1.0x)', 'Hover between Drawing Mode and Writing Mode in bottom bar; 1x Tap confirms, Middle Finger cancels.'],
      ['2x Tap Hold + Move Up / Down', 'Exclusively Zoom In / Out (1.0x full A4 sheet up to 3.5x).'],
      ['2x Tap Hold + Move Left / Right or 3rd Axis', 'Exclusively Drag / Pan when zoomed (> 1.0x). Zoom and Drag never happen together.'],
    ],
  },
  {
    title: '3. Drawing Mode (A4 & Photo Backgrounds)',
    items: [
      ['Move Wrist (No Hold)', 'Aim live crosshair anywhere on paper or photo; 2x Index Tap re-centers pen.'],
      ['1x Index Hold + Move Wrist', 'Draw with active brush (Pen, Brush, Spray, Fill), drag Shape, or erase with Eraser.'],
      ['Swipe Left / Right + 1x Tap', 'Browse Drawing Toolbar (Line thickness, Color, Brush type, Add Shape, Fill color).'],
    ],
  },
  {
    title: '4. Writing Mode & Global Shortcuts',
    items: [
      ['Swipe Up / Down', 'Move cursor across text lines on the document or photo.'],
      ['1x Index Hold + Rotate Left / Right', 'Scrub text caret character-by-character along the current line.'],
      ['Swipe Left / Right + 1x Tap', 'Browse Writing Toolbar (Text Style, Formatting, Size, Bullet Points, Glasses Input).'],
      ['3x Index Tap / Middle Finger', '3x Tap = Undo last edit or stroke. Middle Finger = Step back / Save & return to Menu.'],
    ],
  },
];

export const MenuScreen: React.FC<MenuScreenProps> = React.memo(({
  screen,
  docs,
  settings,
  menuFocusArea,
  menuSelectedIndex,
  cardOptionsDocId,
  cardOptionIndex,
  deleteConfirmDocId,
  deleteConfirmYes,
  settingsRowIndex,
  manualSectionIndex,
  onCloseCardOptions,
  onStartDemo,
  onOpenManual,
  onOpenSettings,
  onSetThemeMode,
  onSetWristMappingMode,
  onBackFromSettings,
  onBackFromManual,
}) => {
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const manualRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (screen !== 'MENU' || menuFocusArea !== 'CARDS') return;
    const el = cardRefs.current[menuSelectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [menuFocusArea, menuSelectedIndex, screen]);

  useEffect(() => {
    if (screen !== 'MANUAL') return;
    const el = manualRefs.current[manualSectionIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [manualSectionIndex, screen]);

  if (screen === 'MANUAL') {
    return (
      <section className="settings-screen manual-screen" aria-label="AirCraft Controls Manual">
        <div className="settings-header">
          <h2 className="settings-title">📖 AirCraft Controls Manual</h2>
          <button
            type="button"
            tabIndex={-1}
            className="settings-back-btn"
            onClick={onBackFromManual}
          >
            ← Back to Menu (Middle Finger)
          </button>
        </div>

        <div className="settings-list">
          {MANUAL_SECTIONS.map((section, idx) => (
            <div
              key={section.title}
              ref={el => {
                manualRefs.current[idx] = el;
              }}
              className={`settings-card ${manualSectionIndex === idx ? 'is-focused' : ''}`}
            >
              <div className="settings-row-title">{section.title}</div>
              <ul className="manual-bullet-list">
                {section.items.map(([control, desc]) => (
                  <li key={control}>
                    <strong>{control}:</strong> {desc}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (screen === 'SETTINGS') {
    return (
      <section className="settings-screen" aria-label="App Settings">
        <div className="settings-header">
          <h2 className="settings-title">⚙️ Settings</h2>
          <button
            type="button"
            tabIndex={-1}
            className="settings-back-btn"
            onClick={onBackFromSettings}
          >
            ← Back to Menu (Middle Finger)
          </button>
        </div>

        <div className="settings-list">
          <div className={`settings-card ${settingsRowIndex === 0 ? 'is-focused' : ''}`}>
            <div className="settings-row-info">
              <div className="settings-row-title">1. A4 Paper Appearance</div>
              <div className="settings-row-desc">
                Choose dark transparent HUD glass or plain white A4 paper in Document View.
              </div>
            </div>
            <div className="settings-options">
              <button
                type="button"
                tabIndex={-1}
                className={`settings-opt-btn ${settings.themeMode === 'transparent' ? 'is-selected' : ''}`}
                onClick={() => onSetThemeMode('transparent')}
              >
                Transparent Mode
              </button>
              <button
                type="button"
                tabIndex={-1}
                className={`settings-opt-btn ${settings.themeMode === 'light' ? 'is-selected' : ''}`}
                onClick={() => onSetThemeMode('light')}
              >
                Light Mode (White A4)
              </button>
            </div>
          </div>

          <div className={`settings-card ${settingsRowIndex === 1 ? 'is-focused' : ''}`}>
            <div className="settings-row-info">
              <div className="settings-row-title">2. Wristband Coordinate Mapping</div>
              <div className="settings-row-desc">
                Switch between drawing in the air with arm stretched out or on a table surface.
              </div>
            </div>
            <div className="settings-options">
              <button
                type="button"
                tabIndex={-1}
                className={`settings-opt-btn ${
                  settings.wristMappingMode === 'stretched-arm' ? 'is-selected' : ''
                }`}
                onClick={() => onSetWristMappingMode('stretched-arm')}
              >
                Stretched out arm
              </button>
              <button
                type="button"
                tabIndex={-1}
                className={`settings-opt-btn ${
                  settings.wristMappingMode === 'horizontal-surface' ? 'is-selected' : ''
                }`}
                onClick={() => onSetWristMappingMode('horizontal-surface')}
              >
                Draw on horizontal surface
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="menu-screen" aria-label="A4 Documents Explorer Menu">
      <div className="menu-topbar">
        <div className="menu-title-group">
          <h1 className="menu-heading">Documents ({docs.length})</h1>
        </div>
        <div className="menu-topbar-actions">
          <button
            type="button"
            tabIndex={-1}
            className={`menu-demo-btn ${menuFocusArea === 'DEMO' ? 'is-focused' : ''}`}
            onClick={onStartDemo}
            title="Start 19s timed Demo 3 (after 3s countdown)"
          >
            ▶ Starte Demo
          </button>
          <button
            type="button"
            tabIndex={-1}
            className={`menu-gear-btn ${menuFocusArea === 'MANUAL' ? 'is-focused' : ''}`}
            onClick={onOpenManual}
            title="Controls Manual (Swipe Up from cards)"
            aria-label="Open Controls Manual"
          >
            📖
          </button>
          <button
            type="button"
            tabIndex={-1}
            className={`menu-gear-btn ${menuFocusArea === 'GEAR' ? 'is-focused' : ''}`}
            onClick={onOpenSettings}
            title="Settings (Swipe Up from cards)"
            aria-label="Open Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="explorer-cards-strip" role="listbox" aria-label="A4 Documents">
        {docs.map((doc, idx) => {
          const isHovered = menuFocusArea === 'CARDS' && menuSelectedIndex === idx;
          const showOptions = cardOptionsDocId === doc.id;
          const showDeleteConfirm = deleteConfirmDocId === doc.id;

          return (
            <div
              key={doc.id}
              ref={el => {
                cardRefs.current[idx] = el;
              }}
              role="option"
              aria-selected={isHovered}
              className={`explorer-doc-card ${isHovered ? 'is-hovered' : ''} ${
                doc.pinned ? 'is-pinned' : ''
              }`}
            >
              <div
                className="explorer-thumb-frame"
                style={{ width: CARD_THUMB_W, height: CARD_THUMB_H }}
              >
                <div
                  className="explorer-thumb-scaler"
                  style={{
                    width: A4_WIDTH,
                    height: A4_HEIGHT,
                    transform: `scale(${CARD_THUMB_W / A4_WIDTH})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <A4PaperView doc={doc} paperTheme="light" isThumbnail />
                </div>

                {doc.pinned && (
                  <span className="card-pin-badge" title="Pinned to top">
                    📌
                  </span>
                )}

                {showOptions && !showDeleteConfirm && (
                  <div
                    className="card-hold-actions-overlay"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`card-icon-action ${cardOptionIndex === 0 ? 'is-selected' : ''}`}
                      title={doc.pinned ? 'Unpin document' : 'Pin document to top'}
                    >
                      📌 {doc.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`card-icon-action is-danger ${
                        cardOptionIndex === 1 ? 'is-selected' : ''
                      }`}
                      title="Delete document"
                    >
                      🗑️ Delete
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="card-icon-close"
                      onClick={onCloseCardOptions}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {showDeleteConfirm && (
                  <div
                    className="card-delete-confirm-overlay"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="delete-confirm-text">Delete Doc {doc.docNumber}?</div>
                    <div className="delete-confirm-btns">
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`confirm-btn ${!deleteConfirmYes ? 'is-selected' : ''}`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`confirm-btn is-danger ${deleteConfirmYes ? 'is-selected' : ''}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="explorer-card-meta">
                <span className="explorer-card-num">Document {doc.docNumber}</span>
                <span className="explorer-card-sub">
                  {doc.backgroundImage
                    ? doc.strokes.length + doc.shapes.length > 0
                      ? `Photo · ${doc.strokes.length + doc.shapes.length} ink`
                      : 'Photo A4'
                    : doc.strokes.length + doc.shapes.length > 0
                      ? `${doc.blocks.length} ln · ${doc.strokes.length + doc.shapes.length} ink`
                      : `${doc.blocks.length} lines`}
                </span>
              </div>
            </div>
          );
        })}

        {/* Rightmost Always-Present Empty A4 New Document Card */}
        <div
          ref={el => {
            cardRefs.current[docs.length] = el;
          }}
          role="option"
          aria-selected={menuFocusArea === 'CARDS' && menuSelectedIndex === docs.length}
          className={`explorer-doc-card explorer-new-card ${
            menuFocusArea === 'CARDS' && menuSelectedIndex === docs.length ? 'is-hovered' : ''
          }`}
        >
          <div
            className="explorer-new-a4-sheet"
            style={{ width: CARD_THUMB_W, height: CARD_THUMB_H }}
          >
            <span className="new-a4-plus">+</span>
            <span className="new-a4-hint">Empty A4 Sheet</span>
          </div>
          <div className="explorer-card-meta">
            <span className="explorer-card-num">New Document</span>
            <span className="explorer-card-sub">White A4</span>
          </div>
        </div>
      </div>
    </section>
  );
});
