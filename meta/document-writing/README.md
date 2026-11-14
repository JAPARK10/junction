# NeuralDoc — Meta Ray-Ban Display Document Creator & 3D Wrist Sketchpad

A Word-like document creation and spatial wrist-drawing web app built specifically for **Meta Ray-Ban Display glasses (600×600 additive display)** and controlled entirely with the **Meta Neural Band (wristband)**.

## Wristband Control Mapping

| Wristband Control | Web Event / Sensor Surface | App Action |
|---|---|---|
| **Swipe Up / Down** | Native spatial navigation (`ArrowUp` / `ArrowDown`, not `preventDefault()`ed in Document mode) | Scroll/move browser focus cleanly between `#document-sheet`, `#plain-glasses-test-input`, and `#neural-writer-input`; **inside Toolbar**, cycles/toggles the selected item's options (e.g. `P/H1/H2/BULLET/QUOTE`, `Bold On/Off`, `Ink Color`) |
| **Swipe Left / Right** | `ArrowLeft` / `ArrowRight` | Step cursor left/right inside the active line; **inside Toolbar**, switch between toolbar categories |
| **Click / 1x Index Tip Tap** | Native `Enter` when a text field is focused; or `Enter` in Document mode | When `#plain-glasses-test-input` or `#neural-writer-input` is selected, `Enter` passes 100% natively to Chromium WebView to open Meta's in-built **System Composer** (handwriting / dictation / on-screen keyboard); from Document mode, focuses `#neural-writer-input`; inside Toolbar, applies/toggles focused option |
| **2x Index Finger Tip Tap** | `Enter` × 2 or double tap | Insert a new line/paragraph at the cursor (or exit Toolbar) |
| **3x Index Finger Tip Tap** | `Enter` × 3 or triple tap (`450 ms` window), or `Menu` button | Open / close the **Word Formatting & Ink Toolbar** (`Style`, `Bold`, `Italic`, `Ink Color`, `Pen Size`, `Undo`, `Export`, etc.) |
| **1x Tap & Hold + Move Wrist** | `Enter` or pointer held (`≥260 ms`) + move forearm in 3D (`emg-wrist`) | Anchor 3D forearm orientation (`FOREARM_AXIS = [0,1,0]`) and draw stabilized ink strokes (`sensitivity = 350`, adaptive EMA + `4 px` lazy-brush deadband) |
| **1x Tap & Hold + Rotate Arm Left / Right** | `Enter` held (`≥260 ms`) + twist forearm roll (`emg-wrist` gravity-anchored roll) | Camera-zoom cursor scrubbing along the active line in Document mode |
| **2x Tap & Hold (Hold 2nd Tap) + Move Wrist** | Quick tip tap followed by `Enter` or pointer held (`≥260 ms`) + move wrist over ink | Activate **Eraser** (`ERASE_HOLD`, `16 px` reticle) and erase all ink strokes it touches; reverts cleanly in one step via `Ctrl+Z` / `2x Side Tap` / `↩ Undo` |
| **1x Index Finger Side Tap** | `Escape` / `Backspace` | Delete character before cursor (or close Toolbar) |
| **2x Index Finger Side Tap / `Ctrl+Z`** | `Escape` × 2 / `Backspace` × 2, `Ctrl+Z` / `Cmd+Z`, or `↩ Undo` button | Undo last drawing stroke or text edit |

## Exposed Wristband APIs & Native Glasses Text Selection

1. **3D Wrist Orientation (`emg-wrist`)** (`src/services/wristSensor.ts`):
   - Feature-detects via `window.RelativeOrientationSensor.__imuQuatWrapped === true` (polling up to 4 s after load while the glasses runtime injects the marker).
   - Reorders incoming `[w, x, y, z]` readings once at the boundary (`toW3C`) to W3C `[x, y, z, w]`.
   - Rotates `FOREARM_AXIS = [0, 1, 0]` into world space (`pointingDirection`), projects onto a reference pointing basis captured at the start of each Hold-to-Draw gesture (no Euler gimbal lock, immune to heading drift), and applies adaptive EMA low-pass smoothing (`alpha` 0.14–0.42) paired with a `4 px` lazy-brush deadband in `src/App.tsx`.
   - Extracts continuous wrist roll via `gravityRollAngle` for camera-zoom cursor scrubbing while keeping ink stroke width constant per selected `Pen Size`.
2. **Native Glasses System Composer + Standalone Plain Test Field** (`src/components/NeuralComposer.tsx`, `src/hooks/useWristbandControls.ts`):
   - Clean spatial focus order across just three targets: `#document-sheet` (`tabIndex={0}`), `#plain-glasses-test-input` (100% vanilla uncontrolled `<input type="text">` with zero React handlers), and `#neural-writer-input` (uncontrolled `<input type="text">` committing text via native `change` / `Enter` directly into the document cursor). All non-text HUD buttons (`tabIndex={-1}`) stay out of Chromium spatial navigation unless `TOOLBAR` mode is open.
   - When an `<input>` or `<textarea>` is targeted or focused, `useWristbandControls.ts` returns immediately in `onKeyDown`/`onKeyUp` without calling `preventDefault()`, allowing native directional navigation (`ArrowUp`/`ArrowDown`) and Click (`Enter`) activation of Meta's in-built System Composer.
   - **Live Capability & Raw Event Probe**: compact `Probe` bar displaying `emg-wrist` status, live `document.activeElement`, Web API support, and raw `focusin`, `input`, `change`, `beforeinput`, `composition*`, and `keydown` events.
3. **Continuous Pinch-and-Drag Opt-In** (`src/styles.css`):
   - Declares `body { touch-action: none; }` in the initial stylesheet and uses `setPointerCapture` on `pointerdown` / `pointermove` / `pointerup`.

## Running Locally & Testing

```bash
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

### 1. Test in Desktop Chrome or Meta Ray-Ban Display Simulator
1. Install the **Meta Ray-Ban Display Simulator** Chrome extension (`https://chromewebstore.google.com/detail/jpjlmmodokemlepklkdbimceggpbjcll`).
2. Open `http://127.0.0.1:4173/` and toggle the extension on to preview the 600×600 additive display (pure `#000000` renders transparent).
3. Use arrow keys / `Enter` / `Escape` or the built-in **Band Sim** drawer to test 4-way swipes, 1x/2x/3x tip taps, side taps, and simulated 3D wrist coordinates (`Hold Tip & Move Wrist` or `Demo Wrist Loop`).

### 2. Test on Physical Meta Ray-Ban Display Glasses (HTTPS Required)
Web apps running on physical Meta Ray-Ban Display glasses **must be served over a publicly reachable HTTPS URL** (for example via **Vercel** using the included `vercel.json`, or a temporary HTTPS tunnel such as Cloudflare Tunnel `cloudflared tunnel --url http://127.0.0.1:4173` / `ngrok http 4173`).

1. Deploy `document-writing` to Vercel (`npx vercel --prod`) or expose local preview over HTTPS.
2. On your paired phone, open the **Meta AI app** → enable **Developer Mode** → **Display Glasses settings → App connections → Web apps → Add a web app** (or scan a QR deep link generated by the Meta Ray-Ban Display Simulator extension) and paste your HTTPS URL.
3. Hardware troubleshooting links (if glasses or Neural Band won't pair or are bound to another account):
   - Glasses Factory Reset: https://www.meta.com/en-gb/help/ai-glasses/814846737027479/
   - Meta Neural Band Factory Reset: https://www.meta.com/en-gb/help/ai-glasses/1481163499576351/
   - Glasses Pairing Help: https://www.meta.com/en-gb/help/ai-glasses/852077233025627/
   - Meta Neural Band Pairing Help: https://www.meta.com/en-gb/help/ai-glasses/770840295349358/

