import React, { useEffect, useRef } from 'react';
import type { InteractionMode } from '../types/document';

export interface InputCapabilityReport {
  emgWristStatus: string;
  activeElementTag: string;
  hasInputEvents: boolean;
  hasCompositionEvents: boolean;
  hasVirtualKeyboard: boolean;
  hasSpeechRecognition: boolean;
  lastRawEvents: string[];
}

interface NeuralComposerProps {
  mode: InteractionMode;
  inputRef: React.RefObject<HTMLInputElement | null>;
  capabilityReport: InputCapabilityReport;
  showProbe: boolean;
  onToggleProbe: () => void;
  onCommitText: (text: string) => void;
  onBackspace: () => void;
  onUndo: () => void;
  onRequestWriteMode: () => void;
  onExitComposer: () => void;
  onOpenToolbar: () => void;
  onRecordRawInputEvent: (eventName: string, detail: string) => void;
  onInputFocusChange?: (focused: boolean) => void;
}

export const NeuralComposer: React.FC<NeuralComposerProps> = ({
  mode,
  inputRef,
  capabilityReport,
  showProbe,
  onToggleProbe,
  onCommitText,
  onBackspace,
  onUndo,
  onRequestWriteMode,
  onExitComposer,
  onOpenToolbar,
  onRecordRawInputEvent,
  onInputFocusChange,
}) => {
  const isComposingRef = useRef(false);
  const isComposerMode = mode === 'COMPOSER';

  // Attach native DOM listeners on #neural-writer-input so Meta System Composer
  // input / change / beforeinput / compositionend events are captured without
  // making the <input> React-controlled.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleBeforeInput = (event: Event) => {
      const ie = event as InputEvent;
      onRecordRawInputEvent(
        'beforeinput',
        `${ie.inputType || 'unknown'} data="${ie.data ?? ''}"`,
      );
    };

    const handleNativeInput = (event: Event) => {
      const ie = event as InputEvent;
      onRecordRawInputEvent(
        'input',
        `val="${el.value}" type=${ie.inputType || 'unknown'}`,
      );
    };

    const handleNativeChange = () => {
      onRecordRawInputEvent('change', `val="${el.value}"`);
      if (!isComposingRef.current && el.value.length > 0) {
        const committed = el.value;
        el.value = '';
        onCommitText(committed);
      }
    };

    const handleCompStart = (event: CompositionEvent) => {
      isComposingRef.current = true;
      onRecordRawInputEvent('compositionstart', `data="${event.data}"`);
    };

    const handleCompUpdate = (event: CompositionEvent) => {
      onRecordRawInputEvent('compositionupdate', `data="${event.data}"`);
    };

    const handleCompEnd = (event: CompositionEvent) => {
      isComposingRef.current = false;
      onRecordRawInputEvent('compositionend', `data="${event.data}" val="${el.value}"`);
    };

    const handleNativeKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isComposingRef.current && el.value.length > 0) {
        event.preventDefault();
        const committed = el.value;
        el.value = '';
        onCommitText(committed);
      }
    };

    const handleFocus = () => {
      onInputFocusChange?.(true);
    };

    const handleBlur = () => {
      onInputFocusChange?.(false);
    };

    el.addEventListener('beforeinput', handleBeforeInput);
    el.addEventListener('input', handleNativeInput);
    el.addEventListener('change', handleNativeChange);
    el.addEventListener('compositionstart', handleCompStart);
    el.addEventListener('compositionupdate', handleCompUpdate);
    el.addEventListener('compositionend', handleCompEnd);
    el.addEventListener('keydown', handleNativeKeyDown);
    el.addEventListener('focus', handleFocus);
    el.addEventListener('blur', handleBlur);

    return () => {
      el.removeEventListener('beforeinput', handleBeforeInput);
      el.removeEventListener('input', handleNativeInput);
      el.removeEventListener('change', handleNativeChange);
      el.removeEventListener('compositionstart', handleCompStart);
      el.removeEventListener('compositionupdate', handleCompUpdate);
      el.removeEventListener('compositionend', handleCompEnd);
      el.removeEventListener('keydown', handleNativeKeyDown);
      el.removeEventListener('focus', handleFocus);
      el.removeEventListener('blur', handleBlur);
    };
  }, [inputRef, onCommitText, onInputFocusChange, onRecordRawInputEvent]);

  const latestRaw = capabilityReport.lastRawEvents[0] ?? 'none yet';

  return (
    <section
      className="composer-region"
      aria-label="Glasses Native Text Fields and Input Capability Probe"
    >
      {/* Capability & Raw Event Probe */}
      <div className="capability-probe-strip">
        <button
          type="button"
          className={`probe-toggle-btn ${showProbe ? 'is-open' : ''}`}
          onClick={onToggleProbe}
          tabIndex={-1}
          title="Toggle live wristband writing capability & DOM event probe"
        >
          Probe · {capabilityReport.emgWristStatus} · Focus: {capabilityReport.activeElementTag} ·{' '}
          {latestRaw}
        </button>

        {showProbe && (
          <div className="probe-details-panel" role="status" aria-live="polite">
            <div className="probe-caps-row">
              <span className="probe-cap-pill is-ok">emg: {capabilityReport.emgWristStatus}</span>
              <span
                className={`probe-cap-pill ${capabilityReport.hasInputEvents ? 'is-ok' : 'is-warn'}`}
              >
                InputEvent: {capabilityReport.hasInputEvents ? 'yes' : 'no'}
              </span>
              <span
                className={`probe-cap-pill ${capabilityReport.hasCompositionEvents ? 'is-ok' : 'is-warn'}`}
              >
                Composition: {capabilityReport.hasCompositionEvents ? 'yes' : 'no'}
              </span>
              <span
                className={`probe-cap-pill ${capabilityReport.hasVirtualKeyboard ? 'is-ok' : 'is-muted'}`}
              >
                VK: {capabilityReport.hasVirtualKeyboard ? 'yes' : 'no'}
              </span>
              <span
                className={`probe-cap-pill ${capabilityReport.hasSpeechRecognition ? 'is-ok' : 'is-muted'}`}
              >
                Speech: {capabilityReport.hasSpeechRecognition ? 'yes' : 'no'}
              </span>
            </div>
            <div className="probe-events-log">
              {capabilityReport.lastRawEvents.length === 0 ? (
                <span className="probe-log-empty">
                  No raw input/change/composition/keydown events observed yet.
                </span>
              ) : (
                capabilityReport.lastRawEvents.map((entry, idx) => (
                  <div key={`${entry}-${idx}`} className="probe-log-line">
                    {entry}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 1) Separate Vanilla Uncontrolled Plain Test Field for Glasses Spatial Selection */}
      <div className="plain-test-bar">
        <span className="plain-test-label">TEST</span>
        <input
          id="plain-glasses-test-input"
          type="text"
          className="plain-test-input"
          placeholder="1) Plain Test Text Field — scroll here & click to test glasses input"
        />
      </div>

      {/* 2) Document Writer Native Text Field & Actions */}
      <div className={`neural-composer-bar ${isComposerMode ? 'is-native-row' : ''}`}>
        <input
          id="neural-writer-input"
          ref={inputRef}
          type="text"
          className="neural-writer-input"
          placeholder="2) Write into Document at Cursor — scroll here & click"
          aria-label="Write into document at cursor"
        />

        <div className="composer-actions">
          <button
            type="button"
            tabIndex={-1}
            className="composer-btn"
            onClick={onBackspace}
            title="Backspace at cursor"
          >
            ⌫
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="composer-btn"
            onClick={onUndo}
            title="Undo last action (Ctrl+Z / 2x Side Tap)"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            tabIndex={-1}
            className={`composer-btn ${mode === 'TOOLBAR' ? 'is-active' : ''}`}
            onClick={onOpenToolbar}
            title="Open Word Toolbar (3x Tip Tap)"
          >
            Menu
          </button>
          {isComposerMode ? (
            <button
              type="button"
              tabIndex={-1}
              className="composer-btn is-primary"
              onClick={onExitComposer}
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              className="composer-btn is-primary"
              onClick={onRequestWriteMode}
            >
              Write
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
