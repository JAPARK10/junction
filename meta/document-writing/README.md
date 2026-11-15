# AirCraft — Smart Glasses Cloud Photo & A4 Document Workspace

**AirCraft** is a spatial A4 document and photo workspace built for **Meta Ray-Ban Display glasses (600×600 additive HUD display)** and controlled hands-free with the **Meta Neural Band**.

---

## How the AirCraft Platform Works

1. **Capture & Share to Your Account**  
   Whenever you capture a photo on your glasses or companion device, you can share and upload it directly to your personal **AirCraft** account.
2. **Cloud Photo & Document Repository**  
   Your personal AirCraft account serves as a live **cloud document and photo repository**. Every photo you have shared to your account — together with any A4 documents created in the app — is synchronized and immediately visible in the **Explorer Menu** when you open the web app.
3. **Annotate Photos & Edit A4 Documents Spatial-First**  
   - **Photo Documents**: Shared photos appear directly as A4 document cards (`Photo A4`) using the uploaded photograph as the canvas background. You can zoom in, pan across details, sketch annotations, place shapes, erase ink, and type captions or notes straight onto any photo.
   - **White / Transparent A4 Sheets**: Create and organize classic A4 sheets (`+ New Document`) for freehand sketching, diagrams, and formatted text notes (`H1`, `H2`, `Subheadline`, `Quote`, bullet/numbered lists).
   - **Organization**: Pin important photos or sheets to the top of your Explorer Menu (`📌 Pin`), remove unwanted files (`🗑️ Delete` with confirmation), and switch between **Transparent HUD Mode** and **Light Mode (White A4)** in Settings.

---

## Complete Controls Reference (Meta Neural Band)

### 1. Explorer Menu, Manual (`📖`) & Settings (`⚙️`)
| Gesture | Action |
| --- | --- |
| **Swipe Left / Right** | Move selection horizontally across A4 documents, synced photos, and `+ New Document`. |
| **Swipe Up / Down** | Move vertically across rows of the 3-column grid. Swiping **Up** from the top row focuses the top-right **📖 Manual** and **⚙️ Settings** icons (Swipe Left/Right to switch between Manual and Settings; Swipe Down returns to cards). |
| **1x Index Tap** | Open the focused document/photo, create a new white A4 sheet on `+ New Document`, or open **📖 Manual** / **⚙️ Settings**. |
| **1x Index Hold (on a card)** | Open card actions: **`📌 Pin / Unpin`** and **`🗑️ Delete`** (Swipe Left/Right to choose, `1x Tap` to confirm). |
| **Middle Finger (Back)** | Close overlays/confirmations, return focus from topbar icons to cards, or return from **Manual** / **Settings** to Menu. |

> You can also open the built-in English **Controls Manual (`📖`)** directly inside the app right next to the Settings gear (`⚙️`) in the Menu top bar.

---

### 2. Switching Modes, Zooming & Panning (Document View)
Every document (both white/transparent A4 sheets and photo-background documents) supports **✏️ Drawing Mode** and **📝 Writing Mode**, with an interactive **top-right Minimap** showing a live red viewport frame.

| Gesture | Action |
| --- | --- |
| **2x Tap Hold + Rotate Forearm Left / Right** *(at `1.0x` zoom)* | Hover between **✏️ Drawing Mode** and **📝 Writing Mode** in the bottom Mode Bar. Release hold, then **`1x Index Tap`** to confirm or **Middle Finger** to cancel. |
| **2x Tap Hold + Move Wrist Up / Down** | **Exclusively Zoom In / Out** between `1.0x` (full A4 page / full photo) and `3.5x`. |
| **2x Tap Hold + Move Wrist Left / Right or 3rd-Axis Tilt/Roll** *(when zoomed in `> 1.0x`)* | **Exclusively Drag / Pan** the zoomed document horizontally and vertically across the viewport. Zooming and dragging are strictly separated so you never accidentally zoom while dragging or drag while zooming. |

---

### 3. Drawing Mode (`✏️ Drawing Mode`)
Drawing works identically on blank A4 sheets and directly on top of uploaded photo backgrounds:

| Gesture | Action |
| --- | --- |
| **Move Wrist (No Hold)** | Aim the live pen crosshair across the page/photo. |
| **2x Index Tap** | Re-center the pen crosshair at your current wrist pose. |
| **1x Index Hold + Move Wrist** | Paint strokes using the active brush (`Standard Pen`, `Brush`, `Spray Paint`, `Fill Color`), drag out geometric shapes (`Circle`, `Rectangle`, `Triangle`, `Arrow`), or erase strokes/shapes when **`Eraser`** is selected. |
| **Swipe Left / Right** | Navigate the top level (or unfolded submenu) of the 2-level Drawing Toolbar. |
| **1x Index Tap** | Unfold the focused toolbar group (`Line thickness`, `Color`, `Brush type`, `Add Shape`, `Fill color`) or pick an option. |
| **Middle Finger (Back)** | Close open Drawing submenu; at top level, save & return to the Explorer Menu. |

**Drawing Toolbar Options**:
- **Line thickness**: `2px`, `4px`, `7px`, `11px`, `16px`
- **Color**: 20-color palette (`10×2` grid)
- **Brush type**: `Standard Pen`, `Brush`, `Spray Paint`, `Fill Color`, `Eraser`
- **Add Shape**: `Circle`, `Rectangle`, `Triangle`, `Arrow`
- **Fill color**: 20-color palette for filled strokes

---

### 4. Writing Mode (`📝 Writing Mode`)
Write, title, and structure text notes on A4 documents or caption uploaded photos:

| Gesture | Action |
| --- | --- |
| **Swipe Up / Down** | Move the active text cursor between lines. |
| **1x Index Hold + Rotate Forearm Left / Right** | Scrub the text caret character-by-character along the active line. |
| **Swipe Left / Right + 1x Tap** | Navigate and apply options in the 2-level Writing Toolbar (`Text Style`, `Formatting`, `Size`, `Bullet Points`, `Glasses Input`). |
| **3x Index Tap** | **Undo** the last stroke, shape, or text edit (up to 45 steps per document). |
| **Middle Finger (Back)** | Close active submenu; at top level, save & return to the Explorer Menu. |

**Writing Toolbar Options**:
- **Text Style**: `Headline 1`, `Headline 2`, `Subheadline`, `Normal Text`, `Quote`
- **Formatting**: `Bold`, `Italic`, `Underline`
- **Size**: `12pt`, `15pt`, `18pt`, `22pt`, `28pt`
- **Bullet Points**: `• Bullet Points`, `1. Numbered List`, `Normal Paragraph`
- **Glasses Input**: Focuses the native `#neural-writer-input` field for Meta system dictation, composer, or keyboard input, alongside `↵ Line`, `⌫`, and `↩ Undo`.

---

## Settings

Accessible from the top-right **⚙️ Gear Icon** in the Explorer Menu:
- **A4 Paper Appearance**: Toggle between **Transparent Mode** (dark translucent HUD glass) and **Light Mode (White A4)** (clean `#ffffff` paper). *(Photo-background documents display their photo regardless of paper tint.)*
- **Wristband Coordinate Mapping**: Switch between **Stretched out arm** (air drawing vertical plane) and **Draw on horizontal surface** (table/desk surface coordinate projection).

---

## Running Locally & Testing

Inside `document-writing/`:

```bash
npm install
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

1. **Desktop Simulator / Browser**: Open `http://127.0.0.1:4173/` and pair with the Meta Ray-Ban Display extension or keyboard shortcuts (`Arrow` keys for swipes, `Enter`/`Space` for tip tap, `Backspace`/`Escape` for Middle Finger Back, `Ctrl+Z` for Undo).
2. **Physical Glasses**: Serve over HTTPS (e.g., GitHub Pages or Vercel) and open via **Meta AI app → Developer Mode → App connections → Web apps**.
