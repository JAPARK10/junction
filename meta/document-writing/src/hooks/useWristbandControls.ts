import { useCallback, useEffect, useRef } from 'react';
import type { AppScreen, DocInteractionMode } from '../types/document';

export interface WristbandControlHandlers {
  screen: AppScreen;
  docMode: DocInteractionMode;
  isLiveWristSensor: boolean;
  onSwipe: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onTipSingleTap: () => void;
  onTipDoubleTap: () => void;
  onTipTripleTap: () => void;
  onTipHoldStart: () => void;
  onTipHoldEnd: () => void;
  onTipDoubleHoldStart: () => void;
  onTipDoubleHoldEnd: () => void;
  onMiddleFingerBack: () => void;
  onUndoShortcut: () => void;
  onGestureLog: (label: string, detail: string) => void;
}

const HOLD_THRESHOLD_MS = 210;
const MULTI_TAP_WINDOW_MS = 280;
const PRESS_DEDUP_MS = 80;

export function useWristbandControls(handlers: WristbandControlHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const tipDownAtRef = useRef<number | null>(null);
  const tipPressSourceRef = useRef<'key' | 'pointer' | null>(null);
  const lastPressDownStampRef = useRef(0);
  const lastPressUpStampRef = useRef(0);

  const activeHoldKindRef = useRef<'none' | 'single' | 'double'>('none');
  const pressTapIndexRef = useRef(0);
  const tipHoldTimerRef = useRef<number | null>(null);
  const tipTapCountRef = useRef(0);
  const tipTapTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (tipHoldTimerRef.current !== null) {
      window.clearTimeout(tipHoldTimerRef.current);
      tipHoldTimerRef.current = null;
    }
    if (tipTapTimerRef.current !== null) {
      window.clearTimeout(tipTapTimerRef.current);
      tipTapTimerRef.current = null;
    }
  }, []);

  const flushTipTaps = useCallback(() => {
    const count = tipTapCountRef.current;
    tipTapCountRef.current = 0;
    if (tipTapTimerRef.current !== null) {
      window.clearTimeout(tipTapTimerRef.current);
      tipTapTimerRef.current = null;
    }
    const h = handlersRef.current;
    if (count === 1) {
      h.onGestureLog('Tip Tap 1x', 'Select / Confirm');
      h.onTipSingleTap();
    } else if (count === 2) {
      h.onGestureLog('Tip Tap 2x', 'Double tip tap');
      h.onTipDoubleTap();
    } else if (count >= 3) {
      h.onGestureLog('Tip Tap 3x', 'Triple tip tap');
      h.onTipTripleTap();
    }
  }, []);

  const activateHold = useCallback((kind: 'single' | 'double') => {
    const h = handlersRef.current;
    activeHoldKindRef.current = kind;
    tipTapCountRef.current = 0;
    if (tipTapTimerRef.current !== null) {
      window.clearTimeout(tipTapTimerRef.current);
      tipTapTimerRef.current = null;
    }
    if (tipHoldTimerRef.current !== null) {
      window.clearTimeout(tipHoldTimerRef.current);
      tipHoldTimerRef.current = null;
    }
    if (kind === 'double') {
      h.onGestureLog('2x Tip + Hold', 'Mode hover / Eraser');
      h.onTipDoubleHoldStart();
    } else {
      h.onGestureLog('1x Tip + Hold', 'Hold active');
      h.onTipHoldStart();
    }
  }, []);

  const beginTipPress = useCallback(
    (source: 'key' | 'pointer' = 'key') => {
      const now = performance.now();
      if (tipDownAtRef.current !== null || now - lastPressDownStampRef.current < PRESS_DEDUP_MS) {
        return;
      }

      if (tipTapTimerRef.current !== null) {
        window.clearTimeout(tipTapTimerRef.current);
        tipTapTimerRef.current = null;
      }

      lastPressDownStampRef.current = now;
      tipDownAtRef.current = now;
      tipPressSourceRef.current = source;
      activeHoldKindRef.current = 'none';
      pressTapIndexRef.current = tipTapCountRef.current;

      if (tipHoldTimerRef.current !== null) {
        window.clearTimeout(tipHoldTimerRef.current);
      }

      tipHoldTimerRef.current = window.setTimeout(() => {
        tipHoldTimerRef.current = null;
        if (tipDownAtRef.current !== null) {
          const kind =
            handlersRef.current.screen !== 'DOCUMENT'
              ? 'single'
              : pressTapIndexRef.current >= 1
                ? 'double'
                : 'single';
          activateHold(kind);
        }
      }, HOLD_THRESHOLD_MS);
    },
    [activateHold],
  );

  const endTipPress = useCallback(
    (source: 'key' | 'pointer' = 'key') => {
      const now = performance.now();
      if (tipDownAtRef.current === null) return;
      if (tipPressSourceRef.current && tipPressSourceRef.current !== source) {
        if (now - lastPressUpStampRef.current < PRESS_DEDUP_MS) return;
      }

      const h = handlersRef.current;
      lastPressUpStampRef.current = now;
      tipDownAtRef.current = null;
      tipPressSourceRef.current = null;

      if (tipHoldTimerRef.current !== null) {
        window.clearTimeout(tipHoldTimerRef.current);
        tipHoldTimerRef.current = null;
      }

      if (activeHoldKindRef.current === 'double') {
        activeHoldKindRef.current = 'none';
        h.onGestureLog('2x Hold Release', 'Released 2x hold');
        h.onTipDoubleHoldEnd();
        return;
      }

      if (activeHoldKindRef.current === 'single') {
        activeHoldKindRef.current = 'none';
        h.onGestureLog('1x Hold Release', 'Released 1x hold');
        h.onTipHoldEnd();
        return;
      }

      if (handlersRef.current.screen !== 'DOCUMENT') {
        if (tipTapTimerRef.current !== null) {
          window.clearTimeout(tipTapTimerRef.current);
          tipTapTimerRef.current = null;
        }
        tipTapCountRef.current = 0;
        handlersRef.current.onTipSingleTap();
        return;
      }

      tipTapCountRef.current += 1;
      if (tipTapCountRef.current >= 3) {
        flushTipTaps();
        return;
      }

      if (tipTapTimerRef.current !== null) {
        window.clearTimeout(tipTapTimerRef.current);
      }
      tipTapTimerRef.current = window.setTimeout(flushTipTaps, MULTI_TAP_WINDOW_MS);
    },
    [flushTipTaps],
  );

  const cancelTipPress = useCallback(() => {
    tipDownAtRef.current = null;
    tipPressSourceRef.current = null;
    if (tipHoldTimerRef.current !== null) {
      window.clearTimeout(tipHoldTimerRef.current);
      tipHoldTimerRef.current = null;
    }
    if (activeHoldKindRef.current === 'double') {
      activeHoldKindRef.current = 'none';
      handlersRef.current.onTipDoubleHoldEnd();
    } else if (activeHoldKindRef.current === 'single') {
      activeHoldKindRef.current = 'none';
      handlersRef.current.onTipHoldEnd();
    }
  }, []);

  const triggerMiddleFingerBack = useCallback(() => {
    const h = handlersRef.current;
    h.onGestureLog('Middle Finger Back', 'Up 1 level / Menu');
    h.onMiddleFingerBack();
  }, []);

  useEffect(() => {
    const isTextElement = (el: EventTarget | null): boolean =>
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

    const onKeyDown = (event: KeyboardEvent) => {
      const h = handlersRef.current;

      // Global Ctrl+Z / Cmd+Z undo
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (!event.repeat) {
          h.onGestureLog('Ctrl+Z', 'Undo');
          h.onUndoShortcut();
        }
        return;
      }

      // When focused inside a text input (e.g., #neural-writer-input in Glasses Input),
      // let Enter/Arrows pass untouched to Meta's System Composer; Escape steps up cleanly.
      if (isTextElement(event.target) || isTextElement(document.activeElement)) {
        if (event.key === 'Escape' || event.key === 'GoBack' || event.key === 'BrowserBack') {
          event.preventDefault();
          if (!event.repeat) {
            triggerMiddleFingerBack();
          }
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        h.onGestureLog('Swipe Up', 'Up');
        h.onSwipe('up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        h.onGestureLog('Swipe Down', 'Down');
        h.onSwipe('down');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        h.onGestureLog('Swipe Left', 'Left');
        h.onSwipe('left');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        h.onGestureLog('Swipe Right', 'Right');
        h.onSwipe('right');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          beginTipPress('key');
        }
      } else if (
        event.key === 'Escape' ||
        event.key === 'Backspace' ||
        event.key === 'GoBack' ||
        event.key === 'BrowserBack'
      ) {
        event.preventDefault();
        if (!event.repeat) {
          triggerMiddleFingerBack();
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isTextElement(event.target) || isTextElement(document.activeElement)) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        endTipPress('key');
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (isTextElement(event.target) || isTextElement(document.activeElement)) {
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      beginTipPress('pointer');
    };

    const onPointerUp = (event: PointerEvent) => {
      if (isTextElement(event.target) || isTextElement(document.activeElement)) {
        return;
      }
      endTipPress('pointer');
    };

    const onPointerCancel = () => {
      cancelTipPress();
    };

    const onBlur = () => {
      if (activeHoldKindRef.current !== 'none') {
        cancelTipPress();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    window.addEventListener('blur', onBlur);

    return () => {
      clearTimers();
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [beginTipPress, cancelTipPress, clearTimers, endTipPress, triggerMiddleFingerBack]);

  return {
    cancelTipPress,
    triggerMiddleFingerBack,
    simulateTipTaps: (count: 1 | 2 | 3) => {
      if (count === 1) {
        handlersRef.current.onGestureLog('Tip Tap 1x', 'Select / Confirm');
        handlersRef.current.onTipSingleTap();
      } else if (count === 2) {
        handlersRef.current.onGestureLog('Tip Tap 2x', 'Double tip tap');
        handlersRef.current.onTipDoubleTap();
      } else {
        handlersRef.current.onGestureLog('Tip Tap 3x', 'Triple tip tap');
        handlersRef.current.onTipTripleTap();
      }
    },
  };
}
