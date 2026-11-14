# NeuralDoc — A4 Document Explorer & Meta Neural Band Workspace

An A4 document explorer, viewer, spatial sketchpad, and writer web app built specifically for **Meta Ray-Ban Display glasses (600×600 additive display)** and controlled with the **Meta Neural Band (wristband)**.

## Operating Structure & Controls

### 1. Explorer Menu (`MENU`) & Settings (`SETTINGS`)
- **Horizontal A4 Document Cards**: Displays saved numbered A4 sheets (`Document 1`, `Document 2`, …) with live white A4 thumbnails (`560×792` scaled), pinned documents kept first, and a rightmost **`+ New Document`** empty white A4 card.
- **Navigation**:
  - **Swipe Left / Right**: Move across document cards.
  - **Swipe Up / Down**: Move focus up to the top-right **⚙️ Settings** gear icon (or back down to cards).
  - **1x Tip Tap**: Open the selected document (always enters **View Mode**), create a new empty white A4 sheet, or open Settings.
  - **1x Tip Hold** on a card: Opens **`📌 Pin / Unpin`** and **`🗑️ Delete`** card actions (Swipe Left/Right to choose, `1x Tip Tap` to apply; Delete asks for confirmation).
- **Settings Screen**:
  - **A4 Paper Appearance**: Switch between **Transparent Mode** (dark transparent HUD glass) and **Light Mode (White A4)** (plain `#ffffff` A4 sheet).
  - **Wristband Coordinate Mapping**: Switch between **Stretched out arm** (air drawing vertical plane) and **Draw on horizontal surface** (table drawing: reaching forward/back maps vertically along Y, left/right maps along X).
  - **Middle Finger / Back**: Steps back from confirmations/overlays up to Menu, or returns from Settings to Menu.

---

### 2. Document View Modes & Bottom Mode Bar (`DOCUMENT`)
Opening any document always starts in **View Mode**. A bottom Mode Bar (`🔍 View Mode`, `✏️ Drawing Mode`, `📝 Writing Mode`) is always visible:
- **Switch Modes (`2x Tip Hold + Rotate Arm Left / Right`)**:
  - Double-tap and hold the second tap, then rotate your forearm left/right to hover across the 3 modes.
  - Release the hold, then **`1x Tip Tap`** to confirm the hovered mode, or **Middle Finger / Back** to cancel and stay in the previous mode.
  - *(In Drawing Mode, `2x Hold + Translate` enters **Eraser**, while `2x Hold + Forearm Roll ≥ 6°` enters the **Mode Switcher**.)*

#### Mode 1 — View Mode (`🔍 View Mode`)
- **`1x Tip Hold + Rotate Arm Left / Right`**: Zoom out (down to full A4 sheet at `1.0x`) and zoom in (up to `3.5x`).
- **`1x Tip Hold + Move Wrist`** (or pointer drag): Pan around the zoomed A4 page.
- **Top-Right Minimap**: Always displays the full A4 document thumbnail with a live **red viewport rectangle** shrinking, growing, and moving with zoom and pan.

#### Mode 2 — Drawing Mode (`✏️ Drawing Mode`)
- **Continuous Pen Crosshair**: Moves with your forearm in 3D space even when not holding to draw (`2x Tip Tap` re-centers at current pose).
- **`1x Tip Hold + Move Wrist`**: Draws with the active brush or drags out the selected shape (`circle`, `rectangle`, `triangle`, `arrow` — colored outline, transparent fill).
- **`2x Tip Hold + Move Wrist`**: Activates the **Eraser** (`16 px` reticle) and erases any ink strokes or shapes touched.
- **Unfolded 2-Level Drawing Tree Toolbar**:
  - **Line thickness**: `2px`, `4px`, `7px`, `11px`, `16px`
  - **Color**: 20-color palette (`10×2` grid)
  - **Brush type**: `Standard Pen`, `Brush`, `Spray Paint`, `Fill Color` (fills drawn loop interior)
  - **Add Shape**: `Circle`, `Rectangle`, `Triangle`, `Arrow`
  - **Fill color**: 20-color palette for filled strokes
  - Selecting a top-level item unfolds its sub-options in place; **Middle Finger / Back** steps back to top level, or out to Menu when at top level.

#### Mode 3 — Writing Mode (`📝 Writing Mode`)
- **Swipe Up / Down**: Move cursor between text lines on the A4 sheet.
- **`1x Tip Hold + Rotate Arm Left / Right`**: Scrub the text cursor left/right along the current line.
- **Unfolded 2-Level Writing Tree Toolbar**:
  - **Text Style**: `Headline 1`, `Headline 2`, `Subheadline`, `Normal Text`, `Quote`
  - **Formatting**: `Bold`, `Italic`, `Underline`
  - **Size**: `12pt`, `15pt`, `18pt`, `22pt`, `28pt`
  - **Bullet Points**: `• Bullet Points`, `1. Numbered List`, `Normal Paragraph`
  - **Glasses Input**: Focuses `#neural-writer-input` (uncontrolled native `<input>` for Meta System Composer / voice / handwriting), plus `↵ Line`, `⌫`, `↩ Undo`, and capability `Probe`.
- **Undo (`Ctrl+Z` / `3x Tip Tap` / `↩`)**: Reverts document strokes, shapes, or text edits per document.

## Running Locally & Testing

```bash
npm install
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

1. **Meta Ray-Ban Display Simulator Extension (Desktop)**: Open `http://127.0.0.1:4173/` and use either the Chrome extension (`600×600` additive frame) or the built-in **Band Sim** drawer (`600×600` toggle, `Swipes`, `Tip 1x / 2x`, `Middle Back`, `1x Hold`, `2x Hold`, and `Yaw / Pitch / Roll` sliders).
2. **Physical Glasses**: Serve over HTTPS (GitHub Pages or Vercel) and open via Meta AI app → Developer Mode → App connections → Web apps.
