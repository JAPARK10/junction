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
  screen: 'MENU' | 'SETTINGS';
  docs: A4Document[];
  settings: AppSettings;
  menuFocusArea: 'CARDS' | 'GEAR';
  menuSelectedIndex: number;
  cardOptionsDocId: string | null;
  cardOptionIndex: 0 | 1; // 0 = Pin, 1 = Delete
  deleteConfirmDocId: string | null;
  deleteConfirmYes: boolean;
  settingsRowIndex: 0 | 1;
  onCloseCardOptions: () => void;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSetWristMappingMode: (mode: WristMappingMode) => void;
  onBackFromSettings: () => void;
}

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
  onCloseCardOptions,
  onSetThemeMode,
  onSetWristMappingMode,
  onBackFromSettings,
}) => {
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (screen !== 'MENU' || menuFocusArea !== 'CARDS') return;
    const el = cardRefs.current[menuSelectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [menuFocusArea, menuSelectedIndex, screen]);

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
        <button
          type="button"
          tabIndex={-1}
          className={`menu-gear-btn ${menuFocusArea === 'GEAR' ? 'is-focused' : ''}`}
          title="Settings (Swipe Up from cards)"
          aria-label="Open Settings"
        >
          ⚙️
        </button>
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
                  {doc.strokes.length + doc.shapes.length > 0
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
