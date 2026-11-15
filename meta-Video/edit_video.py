"""Composite the Meta Ray-Ban UI overlay and external audio onto the main video."""

import os
import shutil
import subprocess
import sys

import cv2
import numpy as np


OVERLAY_START_SEC = 9.3
UI_QUAD_DST = np.float32([
    [70, 120],
    [890, 175],
    [890, 905],
    [70, 960],
])


def build_border_mask(height: int, width: int, margin: int = 12) -> np.ndarray:
    """Create a feathered alpha mask that removes the outer capture border."""
    mask = np.zeros((height, width), dtype=np.float32)
    cv2.rectangle(mask, (margin, margin), (width - margin - 1, height - margin - 1), 1.0, -1)
    return cv2.GaussianBlur(mask, (5, 5), 0)


def compute_ui_rgba(
    ui_bgr: np.ndarray,
    border_mask: np.ndarray,
    halo_kernel: np.ndarray,
) -> np.ndarray:
    """Convert a UI frame on a dark background into a BGRA overlay with drop-shadow halo."""
    f = ui_bgr.astype(np.float32)
    b, g, r = f[:, :, 0], f[:, :, 1], f[:, :, 2]

    luma = 0.114 * b + 0.587 * g + 0.299 * r
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = max_c - min_c

    # Boost colorful UI elements (red/green/teal strokes and icons) so they stay opaque.
    color_boost = np.maximum(0.0, sat - 20.0) * 2.0
    eff = luma + color_boost

    # Key out near-black backgrounds ([10,10,10], [12,16,20], [24,29,37]) while preserving controls.
    fg_alpha = np.clip((eff - 30.0) / (52.0 - 30.0), 0.0, 1.0)

    # Soft dark halo around foreground UI elements preserves text readability over bright areas.
    dilated = cv2.dilate(fg_alpha, halo_kernel)
    halo_alpha = cv2.GaussianBlur(dilated, (21, 21), 0) * 0.55

    # Subtle glass sheen over dark slate interior panels without affecting true-black borders.
    glass_alpha = np.clip((eff - 20.0) / (30.0 - 20.0), 0.0, 1.0) * 0.12

    total_alpha = np.maximum(fg_alpha, np.maximum(halo_alpha, glass_alpha)) * border_mask

    rgb_scale = 0.2 + 0.8 * fg_alpha
    out_bgr = np.clip(f * rgb_scale[:, :, None], 0, 255).astype(np.uint8)
    alpha_u8 = np.clip(total_alpha * 255.0, 0, 255).astype(np.uint8)
    return np.dstack([out_bgr, alpha_u8])


def warp_and_blend(
    main_frame: np.ndarray,
    ui_bgra: np.ndarray,
    perspective_matrix: np.ndarray,
) -> np.ndarray:
    """Apply subtle perspective distortion to the UI overlay and alpha-blend over the main frame."""
    h, w = main_frame.shape[:2]
    warped = cv2.warpPerspective(
        ui_bgra,
        perspective_matrix,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    w_alpha = warped[:, :, 3:4].astype(np.float32) / 255.0
    blended = (
        main_frame.astype(np.float32) * (1.0 - w_alpha)
        + warped[:, :, :3].astype(np.float32) * w_alpha
    )
    return np.clip(blended, 0, 255).astype(np.uint8)


def render_video(
    main_video_path: str,
    ui_video_path: str,
    audio_path: str,
    output_path: str,
    root_copy_path: str,
) -> None:
    """Composite main video, perspective-warped transparent UI overlay, and synced audio."""
    cap_main = cv2.VideoCapture(main_video_path)
    cap_ui = cv2.VideoCapture(ui_video_path)
    if not cap_main.isOpened():
        raise RuntimeError(f"Failed to open main video: {main_video_path}")
    if not cap_ui.isOpened():
        raise RuntimeError(f"Failed to open UI video: {ui_video_path}")

    main_w = int(cap_main.get(cv2.CAP_PROP_FRAME_WIDTH))
    main_h = int(cap_main.get(cv2.CAP_PROP_FRAME_HEIGHT))
    main_fps = cap_main.get(cv2.CAP_PROP_FPS)
    main_n_frames = int(cap_main.get(cv2.CAP_PROP_FRAME_COUNT))

    ui_w = int(cap_ui.get(cv2.CAP_PROP_FRAME_WIDTH))
    ui_h = int(cap_ui.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ui_fps = cap_ui.get(cv2.CAP_PROP_FPS)
    ui_n_frames = int(cap_ui.get(cv2.CAP_PROP_FRAME_COUNT))

    src_pts = np.float32([[0, 0], [ui_w, 0], [ui_w, ui_h], [0, ui_h]])
    perspective_matrix = cv2.getPerspectiveTransform(src_pts, UI_QUAD_DST)
    border_mask = build_border_mask(ui_h, ui_w)
    halo_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))

    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-nostats",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        f"{main_w}x{main_h}",
        "-r",
        f"{main_fps:.12f}",
        "-i",
        "-",
        "-i",
        audio_path,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        output_path,
    ]

    proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.stdin is None:
        raise RuntimeError("Failed to open ffmpeg stdin pipe")

    cur_ui_idx = -1
    cached_ui_bgra: np.ndarray | None = None
    frames_written = 0

    try:
        frame_idx = 0
        while True:
            ret_main, main_frame = cap_main.read()
            if not ret_main:
                break

            main_t = frame_idx / main_fps
            out_frame = main_frame

            if main_t >= OVERLAY_START_SEC:
                target_ui_idx = int(round((main_t - OVERLAY_START_SEC) * ui_fps))
                if 0 <= target_ui_idx < ui_n_frames:
                    while cur_ui_idx < target_ui_idx:
                        ret_ui, ui_frame = cap_ui.read()
                        if not ret_ui:
                            cached_ui_bgra = None
                            break
                        cur_ui_idx += 1
                        if cur_ui_idx == target_ui_idx:
                            cached_ui_bgra = compute_ui_rgba(ui_frame, border_mask, halo_kernel)
                    if cached_ui_bgra is not None and cur_ui_idx == target_ui_idx:
                        out_frame = warp_and_blend(main_frame, cached_ui_bgra, perspective_matrix)

            proc.stdin.write(out_frame.tobytes())
            frames_written += 1
            frame_idx += 1
    finally:
        cap_main.release()
        cap_ui.release()
        if proc.stdin:
            proc.stdin.close()

    stderr_output = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed with exit code {proc.returncode}: {stderr_output}")

    shutil.copy2(output_path, root_copy_path)
    print(
        f"Rendered {frames_written} frames (source reported {main_n_frames}) "
        f"at {main_fps:.6f} fps -> {output_path} and {root_copy_path}"
    )


def main() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    construction_dir = os.path.join(base_dir, "construction")
    render_video(
        main_video_path=os.path.join(construction_dir, "PXL_20261115_034945668.TS.mp4"),
        ui_video_path=os.path.join(construction_dir, "User_Interface.mp4"),
        audio_path=os.path.join(construction_dir, "20261115_062300.m4a"),
        output_path=os.path.join(construction_dir, "edited_video.mp4"),
        root_copy_path=os.path.join(base_dir, "edited_video.mp4"),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
