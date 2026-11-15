# AirCraft — Smart Glasses Cloud Photo & A4 Document Workspace

**AirCraft** is a spatial A4 document and photo workspace designed for **Meta Ray-Ban Display smart glasses (600×600 additive HUD)** and controlled hands-free via the **Meta Neural Band**.

The web app lives in [`document-writing/`](document-writing/).

---

## Platform Architecture & Workflow

1. **Take & Share Photos to Your Account**  
   After taking a photo, share and upload it directly to your personal account on the **AirCraft** platform.
2. **Cloud Photo & Document Repository**  
   Your AirCraft account acts as a unified **cloud repository** for both uploaded photos and created A4 documents. As soon as you open the web app on your glasses, all photos shared to your account alongside your saved sheets appear immediately in the Explorer Menu.
3. **Draw & Write Directly on Photos or A4 Sheets**  
   - **Photo-Background Documents (`Photo A4`)**: Open any uploaded photo as an A4 canvas background and draw freehand ink, place shapes, highlight details, erase strokes, or add structured text notes right over the image.
   - **Standard A4 Sheets**: Create blank A4 sheets (`+ New Document`), pin key items to the top, switch between Transparent HUD Glass and White Paper in Settings, and export/persist edits automatically.

---

## Controls Reference (Meta Neural Band)

### 1. Explorer Menu, Manual (`📖`) & Settings (`⚙️`)
| Gesture | Action |
| --- | --- |
| **Swipe Left / Right / Up / Down** | Navigate the 3-column grid of documents, shared photos, and `+ New Document`. Swiping **Up** from the top row highlights **📖 Manual** and **⚙️ Settings** (Swipe Left/Right switches between them; Swipe Down returns to cards). |
| **1x Index Tap** | Open focused document/photo, create a new sheet, or open **📖 Manual** / **⚙️ Settings**. |
| **1x Index Hold (on card)** | Open **`📌 Pin / Unpin`** and **`🗑️ Delete`** actions (Swipe Left/Right to select, `1x Tap` to confirm). |
| **Middle Finger (Back)** | Dismiss overlays/confirmations, move focus back from topbar to cards, or exit **Manual** / **Settings** to Menu. |

---

### 2. Mode Switching, Exclusive Zoom & 3-Axis Panning (Document View)
| Gesture | Action |
| --- | --- |
| **2x Tap Hold + Rotate Forearm Left / Right** *(at `1.0x` zoom)* | Hover between **✏️ Drawing Mode** and **📝 Writing Mode** in the bottom Mode Bar. Release, then **`1x Index Tap`** to confirm or **Middle Finger** to cancel. |
| **2x Tap Hold + Move Wrist Up / Down** | **Exclusively Zoom In / Out** (`1.0x` full A4 / full photo up to `3.5x`). |
| **2x Tap Hold + Move Wrist Left / Right or 3rd-Axis Tilt/Roll** *(when zoomed `> 1.0x`)* | **Exclusively Drag / Pan** the zoomed page or photo. Zoom and Pan are strictly mutually exclusive so they never trigger simultaneously. |

---

### 3. Drawing Mode (`✏️ Drawing Mode`)
- **Move Wrist (No Hold)**: Aim the live pen crosshair over the A4 paper or photo background (`2x Index Tap` re-centers at current pose).
- **1x Index Hold + Move Wrist**: Draw with the active brush (`Standard Pen`, `Brush`, `Spray Paint`, `Fill Color`), draw shapes (`Circle`, `Rectangle`, `Triangle`, `Arrow`), or erase (`Eraser`).
- **Swipe Left / Right + 1x Tap**: Browse and unfold the 2-level Drawing Toolbar (`Line thickness`, `Color`, `Brush type`, `Add Shape`, `Fill color`).
- **Middle Finger (Back)**: Step back from submenu, or save & return to the Menu.

---

### 4. Writing Mode (`📝 Writing Mode`) & Global Shortcuts
- **Swipe Up / Down**: Move cursor across text lines.
- **1x Index Hold + Rotate Forearm Left / Right**: Scrub cursor position left/right along the active line.
- **Swipe Left / Right + 1x Tap**: Browse the 2-level Writing Toolbar (`Text Style`, `Formatting`, `Size`, `Bullet Points`, `Glasses Input`).
- **3x Index Tap**: **Undo** last stroke, shape, or text change.
- **Middle Finger (Back)**: Step up one UI level or save & return to the Menu.

---

## Development & Build

```bash
cd document-writing
npm install
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

See [`document-writing/README.md`](document-writing/README.md) for the complete module and UI reference.
