import { useEffect, useRef, useState } from 'react';
import type {
  AppScreen,
  DocInteractionMode,
  GestureEventRecord,
  WristMappingMode,
  WristTelemetry,
} from '../types/document';

interface WristTelemetryHudProps {
  telemetry: WristTelemetry;
  screen: AppScreen;
  docMode: DocInteractionMode;
  wristMappingMode: WristMappingMode;
  lastGesture: GestureEventRecord | null;
  simulatorFrame: boolean;
  showEmulatorPanel: boolean;
  onToggleSimulatorFrame: () => void;
  onToggleEmulatorPanel: () => void;
  onSimulatedPose: (yawDeg: number, pitchDeg: number, rollDeg: number) => void;
  onStartHold1Sim: () => void;
  onEndHold1Sim: () => void;
  onStartHold2Sim: () => void;
  onEndHold2Sim: () => void;
  onSimSwipe: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onSimTipTap: (count: 1 | 2 | 3) => void;
  onSimMiddleFingerBack: () => void;
}

function formatVec(vals: readonly number[] | null, digits = 2): string {
  if (!vals) return '--';
  return vals.map(v => v.toFixed(digits)).join(', ');
}

export function WristTelemetryHud({
  telemetry,
  screen,
  docMode,
  wristMappingMode,
  lastGesture,
  simulatorFrame,
  showEmulatorPanel,
  onToggleSimulatorFrame,
  onToggleEmulatorPanel,
  onSimulatedPose,
  onStartHold1Sim,
  onEndHold1Sim,
  onStartHold2Sim,
  onEndHold2Sim,
  onSimSwipe,
  onSimTipTap,
  onSimMiddleFingerBack,
}: WristTelemetryHudProps) {
  const [yawDeg, setYawDeg] = useState(0);
  const [pitchDeg, setPitchDeg] = useState(0);
  const [rollDeg, setRollDeg] = useState(0);
  const [simHolding1, setSimHolding1] = useState(false);
  const [simHolding2, setSimHolding2] = useState(false);
  const waveRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (waveRafRef.current !== null) {
        window.cancelAnimationFrame(waveRafRef.current);
      }
    };
  }, []);

  const updatePose = (y: number, p: number, r: number) => {
    setYawDeg(y);
    setPitchDeg(p);
    setRollDeg(r);
    onSimulatedPose(y, p, r);
  };

  const runWristCircleDemo = () => {
    if (waveRafRef.current !== null) {
      window.cancelAnimationFrame(waveRafRef.current);
      waveRafRef.current = null;
    }
    onSimulatedPose(0, 0, 0);
    onStartHold1Sim();
    setSimHolding1(true);

    const start = performance.now();
    const duration = 2000;
    let lastEmit = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      if (now - lastEmit >= 33 || t >= 1) {
        lastEmit = now;
        const angle = t * Math.PI * 2;
        const y = Math.sin(angle) * 16;
        const p = Math.cos(angle) * 12;
        const r = Math.sin(angle * 2) * 15;
        setYawDeg(Math.round(y));
        setPitchDeg(Math.round(p));
        setRollDeg(Math.round(r));
        onSimulatedPose(y, p, r);
      }

      if (t < 1) {
        waveRafRef.current = window.requestAnimationFrame(tick);
      } else {
        waveRafRef.current = null;
        setSimHolding1(false);
        onEndHold1Sim();
      }
    };

    waveRafRef.current = window.requestAnimationFrame(tick);
  };

  const statusBadge =
    telemetry.status === 'live'
      ? { label: 'EMG LIVE', cls: 'badge-live' }
      : telemetry.status === 'not-worn'
        ? { label: 'NOT WORN', cls: 'badge-warn' }
        : telemetry.status === 'permission-denied'
          ? { label: 'DENIED', cls: 'badge-warn' }
          : telemetry.status === 'checking'
            ? { label: 'SCAN…', cls: 'badge-dim' }
            : { label: 'SIM', cls: 'badge-sim' };

  const modeLabel =
    screen === 'MENU'
      ? 'EXPLORER MENU'
      : screen === 'SETTINGS'
        ? 'SETTINGS'
        : docMode === 'WRITE'
          ? 'WRITING MODE'
          : 'DRAWING MODE';

  return (
    <div className="hud-wrapper">
      <div className="status-strip">
        <span className={`sensor-pill ${statusBadge.cls}`}>{statusBadge.label}</span>
        <span className="mode-pill">{modeLabel}</span>
        <span className="mapping-chip">
          {wristMappingMode === 'horizontal-surface' ? 'Table' : 'Arm'}
        </span>
        <span className="gesture-echo" aria-live="polite">
          {lastGesture ? `${lastGesture.label}: ${lastGesture.detail}` : 'Ready'}
        </span>
        <div className="hud-actions">
          <button
            type="button"
            tabIndex={-1}
            className="hud-mini-btn"
            onClick={onToggleSimulatorFrame}
          >
            {simulatorFrame ? 'Full' : '600×600'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="hud-mini-btn"
            onClick={onToggleEmulatorPanel}
          >
            {showEmulatorPanel ? 'Hide Sim' : 'Band Sim'}
          </button>
        </div>
      </div>

      {showEmulatorPanel && (
        <section className="emulator-drawer" aria-label="Meta Neural Band 3D and Gesture Simulator">
          <div className="telemetry-grid">
            <div>
              <span className="tele-key">W3C Quat</span>
              <code className="tele-val">{formatVec(telemetry.w3cQuat)}</code>
            </div>
            <div>
              <span className="tele-key">Delta ({wristMappingMode})</span>
              <code className="tele-val">
                {telemetry.deltaPointing
                  ? `${telemetry.deltaPointing.dx.toFixed(2)}, ${telemetry.deltaPointing.dy.toFixed(2)}`
                  : 'idle'}{' '}
                | {telemetry.rollDeg}°
              </code>
            </div>
          </div>

          <div className="sim-controls-row">
            <div className="sim-cluster">
              <span className="sim-cluster-title">Swipes</span>
              <div className="sim-btn-group">
                <button type="button" tabIndex={-1} onClick={() => onSimSwipe('up')}>↑</button>
                <button type="button" tabIndex={-1} onClick={() => onSimSwipe('down')}>↓</button>
                <button type="button" tabIndex={-1} onClick={() => onSimSwipe('left')}>←</button>
                <button type="button" tabIndex={-1} onClick={() => onSimSwipe('right')}>→</button>
              </div>
            </div>

            <div className="sim-cluster">
              <span className="sim-cluster-title">Taps &amp; Middle Finger</span>
              <div className="sim-btn-group">
                <button type="button" tabIndex={-1} onClick={() => onSimTipTap(1)}>Tip 1x</button>
                <button type="button" tabIndex={-1} onClick={() => onSimTipTap(2)}>Tip 2x</button>
                <button type="button" tabIndex={-1} onClick={onSimMiddleFingerBack}>Middle Back</button>
              </div>
            </div>

            <div className="sim-cluster">
              <span className="sim-cluster-title">Holds (1x Action · 2x Mode/Erase)</span>
              <div className="sim-btn-group">
                <button
                  type="button"
                  tabIndex={-1}
                  className={simHolding1 ? 'is-active-hold' : ''}
                  onPointerDown={() => {
                    setSimHolding1(true);
                    onStartHold1Sim();
                  }}
                  onPointerUp={() => {
                    if (simHolding1) {
                      setSimHolding1(false);
                      onEndHold1Sim();
                    }
                  }}
                  onPointerLeave={() => {
                    if (simHolding1) {
                      setSimHolding1(false);
                      onEndHold1Sim();
                    }
                  }}
                >
                  {simHolding1 ? '1x Holding…' : '1x Hold'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className={simHolding2 ? 'is-active-erase-hold' : ''}
                  onPointerDown={() => {
                    setSimHolding2(true);
                    onStartHold2Sim();
                  }}
                  onPointerUp={() => {
                    if (simHolding2) {
                      setSimHolding2(false);
                      onEndHold2Sim();
                    }
                  }}
                  onPointerLeave={() => {
                    if (simHolding2) {
                      setSimHolding2(false);
                      onEndHold2Sim();
                    }
                  }}
                >
                  {simHolding2 ? '2x Holding…' : '2x Hold (Mode/Erase)'}
                </button>
                <button type="button" tabIndex={-1} onClick={runWristCircleDemo}>
                  Loop
                </button>
              </div>
            </div>
          </div>

          <div className="sim-sliders">
            <label>
              Yaw ({yawDeg}°)
              <input
                type="range"
                tabIndex={-1}
                min={-35}
                max={35}
                value={yawDeg}
                onChange={e => updatePose(Number(e.target.value), pitchDeg, rollDeg)}
              />
            </label>
            <label>
              Pitch ({pitchDeg}°)
              <input
                type="range"
                tabIndex={-1}
                min={-30}
                max={30}
                value={pitchDeg}
                onChange={e => updatePose(yawDeg, Number(e.target.value), rollDeg)}
              />
            </label>
            <label>
              Roll ({rollDeg}°)
              <input
                type="range"
                tabIndex={-1}
                min={-60}
                max={60}
                value={rollDeg}
                onChange={e => updatePose(yawDeg, pitchDeg, Number(e.target.value))}
              />
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
