from app.services.color_utils import rgb_to_oklch, clamp_oklch_for_display


def test_rgb_to_oklch_white():
    L, C, H = rgb_to_oklch(255, 255, 255)
    assert L > 0.99
    assert C < 0.01


def test_rgb_to_oklch_black():
    L, C, H = rgb_to_oklch(0, 0, 0)
    assert L < 0.01


def test_rgb_to_oklch_red():
    L, C, H = rgb_to_oklch(255, 0, 0)
    assert 0.5 < L < 0.7
    assert C > 0.15
    assert 20 < H < 40  # red hue ~29°


def test_clamp_oklch():
    result = clamp_oklch_for_display(0.9, 0.03, 185)
    assert result.startswith("oklch(0.70")   # L clamped to 0.70
    assert "0.15" in result                   # C bumped to 0.15


def test_clamp_oklch_format():
    s = clamp_oklch_for_display(0.55, 0.18, 185)
    assert s.startswith("oklch(")
    assert s.endswith(")")
