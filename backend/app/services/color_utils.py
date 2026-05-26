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


def clamp_oklch_for_display(L: float, C: float, H: float) -> str:
    """Clamp OKLCH to contrast-safe range, return CSS oklch() string."""
    L = max(0.40, min(0.70, L))
    C = max(0.15, min(0.35, C))
    return f"oklch({L:.4f} {C:.4f} {H:.1f})"
