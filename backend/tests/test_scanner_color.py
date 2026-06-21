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
    assert "0.08" in result                   # C bumped to 0.08


def test_clamp_oklch_format():
    s = clamp_oklch_for_display(0.55, 0.18, 185)
    assert s.startswith("oklch(")
    assert s.endswith(")")


from app.services.file_scanner import extract_dominant_colors


def _make_png_1x1(r: int, g: int, b: int) -> bytes:
    """Create a minimal 1×1 solid-color PNG."""
    import zlib, struct
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00" + bytes([r, g, b])
    idat = zlib.compress(raw)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", idat)
            + chunk(b"IEND", b""))


def test_extract_dominant_colors_vivid():
    png = _make_png_1x1(220, 50, 50)  # vivid red
    c1, c2 = extract_dominant_colors(png)
    assert c1 is not None
    assert c1.startswith("oklch(")


def test_extract_dominant_colors_bad_data():
    c1, c2 = extract_dominant_colors(b"not an image")
    assert c1 is None
    assert c2 is None
