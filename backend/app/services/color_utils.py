"""OKLCH color utilities — no external dependencies."""
import math


def _linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_oklch(r: int, g: int, b: int) -> tuple[float, float, float]:
    """sRGB (0–255) → OKLCH (L 0–1, C 0–0.4+, H 0–360)."""
    lr = _linear(r / 255.0)
    lg = _linear(g / 255.0)
    lb = _linear(b / 255.0)

    l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
    m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
    s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

    l, m, s = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)

    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    b_ = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

    C = math.sqrt(a * a + b_ * b_)
    H = math.degrees(math.atan2(b_, a)) % 360.0
    return L, C, H


def extract_bright_region(art_data: bytes) -> tuple[bytes | None, int, int, int, int]:
    """
    Find the brightest, most-saturated region of album art and crop a 64×64 PNG.

    Returns (thumb_png_bytes, x, y, w, h) in original-image coords,
    or (None, 0, 0, 0, 0) on failure.

    Algorithm (pure Pillow, no numpy):
      1. Draft-decode to ≤256px, resize to 32×32 via BOX aggregation.
      2. Convert to HSV; score each macro-pixel: (V/255) * (1 + 0.6 * S/255).
         Saturation-weight ensures a glowing colored light beats a dull bright patch.
      3. Find the macro-pixel with the highest score.
      4. Map that coordinate back to the original image and crop 64×64.
      5. Fallback: if all scores are near-equal (uniform art) → center crop.
    """
    try:
        from io import BytesIO
        from PIL import Image

        buf = BytesIO(art_data)
        img = Image.open(buf)
        img.draft("RGB", (256, 256))
        img = img.convert("RGB")
        orig_w, orig_h = img.size

        GRID = 32
        CROP = 64

        # BOX resampling naturally averages blocks of pixels → spatial low-pass filter
        small = img.resize((GRID, GRID), resample=Image.BOX)
        hsv = small.convert("HSV")
        pix = hsv.load()

        best_score = -1.0
        best_gx, best_gy = GRID // 2, GRID // 2
        min_score = 1e9
        max_score_raw = -1e9

        for gx in range(GRID):
            for gy in range(GRID):
                _, s, v = pix[gx, gy]
                score = (v / 255.0) * (1.0 + 0.6 * (s / 255.0))
                if score > best_score:
                    best_score = score
                    best_gx, best_gy = gx, gy
                min_score = min(min_score, score)
                max_score_raw = max(max_score_raw, score)

        # Uniform image fallback (low contrast) → center crop
        if (max_score_raw - min_score) < 0.08:
            best_gx, best_gy = GRID // 2, GRID // 2

        # Map macro-pixel center → original image coords
        scale_x = orig_w / GRID
        scale_y = orig_h / GRID
        cx = int((best_gx + 0.5) * scale_x)
        cy = int((best_gy + 0.5) * scale_y)

        half = CROP // 2
        left = max(0, min(cx - half, orig_w - CROP))
        top  = max(0, min(cy - half, orig_h - CROP))
        # Ensure crop fits even on tiny art
        right  = min(orig_w, left + CROP)
        bottom = min(orig_h, top + CROP)

        crop_img = img.crop((left, top, right, bottom)).resize((CROP, CROP), Image.LANCZOS)
        out = BytesIO()
        crop_img.save(out, format="PNG")
        out.seek(0)
        return out.read(), left, top, right - left, bottom - top

    except Exception:
        return None, 0, 0, 0, 0


def clamp_oklch_for_display(L: float, C: float, H: float) -> str:
    """Clamp OKLCH to contrast-safe range, return CSS oklch() string."""
    L = max(0.40, min(0.70, L))
    C = max(0.15, min(0.35, C))
    return f"oklch({L:.4f} {C:.4f} {H:.1f})"
