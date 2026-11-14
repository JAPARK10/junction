import React, { useEffect, useRef } from 'react';

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
  inputRef: React.RefObject<HTMLInputElement | null>;
  capabilityReport: InputCapabilityReport;
  showProbe: boolean;
  onToggleProbe: () => void;
  onCommitText: (text: string) => void;
  onNewLine: () => void;
  onBackspace: () => void;
  onUndo: () => void;
  onRecordRawInputEvent: (eventName: string, detail: string) => void;
}

export const NeuralComposer: React.FC<NeuralComposerProps> = ({
  inputRef,
  capabilityReport,
  showProbe,
  onToggleProbe,
  onCommitText,
  onNewLine,
  onBackspace,
  onUndo,
  onRecordRawInputEvent,
}) => {
  const isComposingRef = useRef(false);

  // Uncontrolled native DOM listeners so Meta System Composer input/change/compositionend
  // commit cleanly at the document cursor without React interfering with native input.
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

    const handleCompEnd = (event: CompositionEvent) => {
      isComposingRef.current = false;
      onRecordRawInputEvent('compositionend', `data="${event.data}" val="${el.value}"`);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isComposingRef.current && el.value.length > 0) {
        event.preventDefault();
        const committed = el.value;
        el.value = '';
        onCommitText(committed);
      }
    };

    el.addEventListener('beforeinput', handleBeforeInput);
    el.addEventListener('input', handleNativeInput);
    el.addEventListener('change', handleNativeChange);
    el.addEventListener('compositionstart', handleCompStart);
    el.addEventListener('compositionend', handleCompEnd);
    el.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('beforeinput', handleBeforeInput);
      el.removeEventListener('input', handleNativeInput);
      el.removeEventListener('change', handleNativeChange);
      el.removeEventListener('compositionstart', handleCompStart);
      el.removeEventListener('compositionend', handleCompEnd);
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef, onCommitText, onRecordRawInputEvent]);

  const latestRaw = capabilityReport.lastRawEvents[0] ?? 'none yet';

  return (
    <div className="write-input-subpanel">
      <div className="neural-composer-bar">
        <input
          id="neural-writer-input"
          ref={inputRef}
          type="text"
          className="neural-writer-input"
          placeholder="Click / Tip here for Glasses Input at cursor…"
          aria-label="Glasses text input at cursor"
        />
        <div className="composer-actions">
          <button
            type="button"
            tabIndex={-1}
            className="composer-btn"
            onClick={onNewLine}
            title="Insert new line"
          >
            ↵ Line
          </button>
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
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
        </div>
      </div>

      <button
        type="button"
        tabIndex={-1}
        className={`probe-toggle-btn ${showProbe ? 'is-open' : ''}`}
        onClick={onToggleProbe}
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
              Input: {capabilityReport.hasInputEvents ? 'yes' : 'no'}
            </span>
            <span
              className={`probe-cap-pill ${capabilityReport.hasCompositionEvents ? 'is-ok' : 'is-warn'}`}
            >
              Comp: {capabilityReport.hasCompositionEvents ? 'yes' : 'no'}
            </span>
            <span
              className={`probe-cap-pill ${capabilityReport.hasSpeechRecognition ? 'is-ok' : 'is-muted'}`}
            >
              Speech: {capabilityReport.hasSpeechRecognition ? 'yes' : 'no'}
            </span>
          </div>
          <div className="probe-events-log">
            {capabilityReport.lastRawEvents.length === 0 ? (
              <span className="probe-log-empty">No raw input events yet.</span>
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
  );
};
