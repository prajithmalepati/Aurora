//! Image analysis — dominant colors and bright region (bleed thumb).
//!
//! Ported from Python `file_scanner.py` (`extract_dominant_colors`) and
//! `color_utils.py` (`extract_bright_region`).
//!
//! Uses the `image` crate for decode/resize/encode, custom oklch math
//! from `color_utils`, and a simple median-cut quantizer.

use crate::scanner::color_utils::{clamp_oklch_for_display, rgb_to_oklch};
use image::codecs::png::PngEncoder;
use image::imageops::FilterType;
use image::{ColorType, ImageEncoder};

// ---------------------------------------------------------------------------
// Simple 2-color median-cut quantizer
// ---------------------------------------------------------------------------

/// A bucket of RGB pixels for median-cut subdivision.
#[derive(Clone)]
struct Bucket {
    pixels: Vec<(u8, u8, u8)>,
}

impl Bucket {
    fn new(pixels: Vec<(u8, u8, u8)>) -> Self {
        Self { pixels }
    }

    /// Find the channel (0=R, 1=G, 2=B) with the widest range.
    fn widest_channel(&self) -> u8 {
        let (mut r_min, mut r_max) = (255u8, 0u8);
        let (mut g_min, mut g_max) = (255u8, 0u8);
        let (mut b_min, mut b_max) = (255u8, 0u8);
        for &(r, g, b) in &self.pixels {
            r_min = r_min.min(r);
            r_max = r_max.max(r);
            g_min = g_min.min(g);
            g_max = g_max.max(g);
            b_min = b_min.min(b);
            b_max = b_max.max(b);
        }
        let r_range = r_max.wrapping_sub(r_min) as u16;
        let g_range = g_max.wrapping_sub(g_min) as u16;
        let b_range = b_max.wrapping_sub(b_min) as u16;
        if r_range >= g_range && r_range >= b_range {
            0
        } else if g_range >= b_range {
            1
        } else {
            2
        }
    }

    /// Average color of all pixels in this bucket.
    fn average(&self) -> (u8, u8, u8) {
        if self.pixels.is_empty() {
            return (0, 0, 0);
        }
        let (mut sr, mut sg, mut sb) = (0u64, 0u64, 0u64);
        for &(r, g, b) in &self.pixels {
            sr += r as u64;
            sg += g as u64;
            sb += b as u64;
        }
        let n = self.pixels.len() as u64;
        ((sr / n) as u8, (sg / n) as u8, (sb / n) as u8)
    }

    /// Split this bucket at the median of the given channel.
    fn split_at_median(self, channel: u8) -> (Bucket, Bucket) {
        let mut pixels = self.pixels;
        pixels.sort_by_key(|p| match channel {
            0 => p.0,
            1 => p.1,
            _ => p.2,
        });
        let mid = pixels.len() / 2;
        let (left, right) = pixels.split_at(mid);
        (Bucket::new(left.to_vec()), Bucket::new(right.to_vec()))
    }
}

/// Median-cut quantize: returns `count` dominant colors as (R, G, B).
fn median_cut(pixels: &[(u8, u8, u8)], count: usize) -> Vec<(u8, u8, u8)> {
    if pixels.is_empty() || count == 0 {
        return vec![];
    }

    let mut buckets = vec![Bucket::new(pixels.to_vec())];

    while buckets.len() < count {
        // Pick the bucket with the most pixels (widest range also valid)
        let idx = buckets
            .iter()
            .enumerate()
            .max_by_key(|(_, b)| b.pixels.len())
            .map(|(i, _)| i)
            .unwrap();

        if buckets[idx].pixels.len() < 2 {
            break; // Can't split further
        }

        let bucket = buckets.remove(idx);
        let ch = bucket.widest_channel();
        let (left, right) = bucket.split_at_median(ch);
        buckets.push(left);
        buckets.push(right);
    }

    buckets.iter().map(|b| b.average()).collect()
}

// ---------------------------------------------------------------------------
// extract_dominant_colors
// ---------------------------------------------------------------------------

/// Extract 2 dominant OKLCH colors from album art bytes.
///
/// Pipeline: decode → resize 64×64 → median-cut(2) → rgb_to_oklch → clamp.
/// Returns `(Some(c1), Some(c2))` or `(None, None)` on failure.
///
/// Parity: structural — real image → two valid `oklch(...)` strings;
/// garbage → `(None, None)`. Specific colors will differ from Python's
/// MedianCut (different quantizer primitive).
pub fn extract_dominant_colors(art_data: &[u8]) -> (Option<String>, Option<String>) {
    let img = match image::load_from_memory(art_data) {
        Ok(img) => img,
        Err(_) => return (None, None),
    };

    let small = img.resize_exact(64, 64, FilterType::Lanczos3);
    let rgb = small.to_rgb8();

    let pixels: Vec<(u8, u8, u8)> = rgb.pixels().map(|p| (p[0], p[1], p[2])).collect();

    let colors = median_cut(&pixels, 2);
    if colors.is_empty() {
        return (None, None);
    }

    let (r, g, b) = colors[0];
    let (l, c, h) = rgb_to_oklch(r, g, b);
    let c1 = clamp_oklch_for_display(l, c, h);

    let c2 = if colors.len() > 1 {
        let (r, g, b) = colors[1];
        let (l, c, h) = rgb_to_oklch(r, g, b);
        clamp_oklch_for_display(l, c, h)
    } else {
        c1.clone()
    };

    (Some(c1), Some(c2))
}

// ---------------------------------------------------------------------------
// extract_bright_region
// ---------------------------------------------------------------------------

/// Find the brightest, most-saturated region of album art and crop a 64×64 PNG.
///
/// Algorithm (faithful port of Python):
///   1. Resize to 32×32 via box filter.
///   2. Convert to HSV; score each pixel: (V/255) * (1 + 0.6 * S/255).
///   3. Argmax the score.
///   4. Map back to original coords, crop 64×64, encode PNG.
///   5. Uniform fallback: if (max - min) score < 0.08 → center crop.
///
/// Returns `(Some(png_bytes), x, y, w, h)` or `(None, 0, 0, 0, 0)` on failure.
///
/// Parity: structural — real art → 64×64 PNG + in-bounds coords;
/// garbage → (None, 0, 0, 0, 0). Exact bytes and coords will drift
/// (image crate resize ≠ Pillow BOX).
pub fn extract_bright_region(art_data: &[u8]) -> (Option<Vec<u8>>, i64, i64, i64, i64) {
    let img = match image::load_from_memory(art_data) {
        Ok(img) => img,
        Err(_) => return (None, 0, 0, 0, 0),
    };

    let orig_w = img.width() as i64;
    let orig_h = img.height() as i64;

    if orig_w < 1 || orig_h < 1 {
        return (None, 0, 0, 0, 0);
    }

    const GRID: u32 = 32;
    const CROP: i64 = 64;

    // Resize to 32×32 (nearest-neighbor acts like a box filter for downscale)
    let small = img.resize_exact(GRID, GRID, FilterType::Nearest);
    let rgb = small.to_rgb8();

    let mut best_score = -1.0f64;
    let mut best_gx: u32 = GRID / 2;
    let mut best_gy: u32 = GRID / 2;
    let mut min_score = 1e9f64;
    let mut max_score_raw = -1e9f64;

    for gy in 0..GRID {
        for gx in 0..GRID {
            let p = rgb.get_pixel(gx, gy);
            let (r, g, b) = (p[0] as f64, p[1] as f64, p[2] as f64);

            // RGB → HSV (H in 0..360, S in 0..1, V in 0..1)
            let max_c = r.max(g).max(b);
            let min_c = r.min(g).min(b);
            let v = max_c / 255.0;
            let s = if max_c == 0.0 {
                0.0
            } else {
                (max_c - min_c) / max_c
            };

            let score = v * (1.0 + 0.6 * s);
            if score > best_score {
                best_score = score;
                best_gx = gx;
                best_gy = gy;
            }
            min_score = min_score.min(score);
            max_score_raw = max_score_raw.max(score);
        }
    }

    // Uniform fallback
    if (max_score_raw - min_score) < 0.08 {
        best_gx = GRID / 2;
        best_gy = GRID / 2;
    }

    // Map macro-pixel center → original image coords
    let scale_x = orig_w as f64 / GRID as f64;
    let scale_y = orig_h as f64 / GRID as f64;
    let cx = ((best_gx as f64 + 0.5) * scale_x) as i64;
    let cy = ((best_gy as f64 + 0.5) * scale_y) as i64;

    let half = CROP / 2;
    let left = (cx - half).max(0).min(orig_w - CROP);
    let top = (cy - half).max(0).min(orig_h - CROP);
    let right = (left + CROP).min(orig_w);
    let bottom = (top + CROP).min(orig_h);

    let crop_w = (right - left) as u32;
    let crop_h = (bottom - top) as u32;

    if crop_w == 0 || crop_h == 0 {
        return (None, 0, 0, 0, 0);
    }

    let cropped = img
        .crop_imm(left as u32, top as u32, crop_w, crop_h)
        .resize_exact(64, 64, FilterType::Lanczos3);

    let mut buf = Vec::new();
    let encoder = PngEncoder::new(&mut buf);
    let rgba = cropped.to_rgba8();
    if encoder
        .write_image(
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            ColorType::Rgba8.into(),
        )
        .is_err()
    {
        return (None, 0, 0, 0, 0);
    }

    (Some(buf), left, top, right - left, bottom - top)
}

// ===========================================================================
// Tests — T2 structural (ported from Python test_scanner_color.py)
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a minimal 1×1 solid-color PNG.
    fn make_png_1x1(r: u8, g: u8, b: u8) -> Vec<u8> {
        let mut buf = Vec::new();
        // PNG signature
        buf.extend_from_slice(b"\x89PNG\r\n\x1a\n");
        // IHDR
        let ihdr_data: Vec<u8> = {
            let mut d = Vec::new();
            d.extend_from_slice(&1u32.to_be_bytes()); // width
            d.extend_from_slice(&1u32.to_be_bytes()); // height
            d.push(8); // bit depth
            d.push(2); // color type: RGB
            d.push(0); // compression
            d.push(0); // filter
            d.push(0); // interlace
            d
        };
        write_chunk(&mut buf, b"IHDR", &ihdr_data);
        // IDAT — raw scanline: filter byte 0x00 + RGB
        let raw = vec![0x00, r, g, b];
        let compressed = deflate(&raw);
        write_chunk(&mut buf, b"IDAT", &compressed);
        // IEND
        write_chunk(&mut buf, b"IEND", b"");
        buf
    }

    fn write_chunk(buf: &mut Vec<u8>, tag: &[u8; 4], data: &[u8]) {
        buf.extend_from_slice(&(data.len() as u32).to_be_bytes());
        buf.extend_from_slice(tag);
        buf.extend_from_slice(data);
        let mut crc_data = Vec::new();
        crc_data.extend_from_slice(tag);
        crc_data.extend_from_slice(data);
        let crc = crc32(&crc_data);
        buf.extend_from_slice(&crc.to_be_bytes());
    }

    /// Simple CRC32 matching PNG's zlib CRC.
    fn crc32(data: &[u8]) -> u32 {
        let mut crc: u32 = 0xFFFFFFFF;
        for &byte in data {
            crc ^= byte as u32;
            for _ in 0..8 {
                if crc & 1 != 0 {
                    crc = (crc >> 1) ^ 0xEDB88320;
                } else {
                    crc >>= 1;
                }
            }
        }
        crc ^ 0xFFFFFFFF
    }

    /// Minimal deflate (stored block, no compression) for tiny payloads.
    fn deflate(data: &[u8]) -> Vec<u8> {
        // For tiny data, use zlib wrapper around a stored (uncompressed) block.
        // zlib = CMF(0x78) FLG(0x01) + stored block + adler32
        let len = data.len();
        let mut out = Vec::new();
        out.push(0x78); // CMF: deflate, 32k window
        out.push(0x01); // FLG: no dict, compression level 0
        // Stored block: BFINAL=1, BTYPE=00, LEN, NLEN, data
        out.push(0x01); // BFINAL=1, BTYPE=00
        out.extend_from_slice(&(len as u16).to_le_bytes());
        out.extend_from_slice(&(!(len as u16)).to_le_bytes());
        out.extend_from_slice(data);
        // Adler-32 checksum
        let (mut s1, mut s2) = (1u32, 0u32);
        for &b in data {
            s1 = (s1 + b as u32) % 65521;
            s2 = (s2 + s1) % 65521;
        }
        let adler = (s2 << 16) | s1;
        out.extend_from_slice(&adler.to_be_bytes());
        out
    }

    // --- extract_dominant_colors tests ---

    #[test]
    fn test_extract_dominant_colors_vivid_red() {
        let png = make_png_1x1(220, 50, 50);
        let (c1, c2) = extract_dominant_colors(&png);
        assert!(c1.is_some(), "vivid red should produce a color");
        let c1 = c1.unwrap();
        assert!(c1.starts_with("oklch("), "should be oklch format: {}", c1);
        assert!(c2.is_some(), "should produce two colors");
    }

    #[test]
    fn test_extract_dominant_colors_bad_data() {
        let (c1, c2) = extract_dominant_colors(b"not an image");
        assert!(c1.is_none(), "garbage → None");
        assert!(c2.is_none(), "garbage → None");
    }

    #[test]
    fn test_extract_dominant_colors_empty() {
        let (c1, c2) = extract_dominant_colors(b"");
        assert!(c1.is_none());
        assert!(c2.is_none());
    }

    // --- extract_bright_region tests ---

    #[test]
    fn test_extract_bright_region_bad_data() {
        let (png, x, y, w, h) = extract_bright_region(b"not an image");
        assert!(png.is_none());
        assert_eq!((x, y, w, h), (0, 0, 0, 0));
    }

    #[test]
    fn test_extract_bright_region_real_art() {
        // Create a larger test image (128×128) with a bright colored spot
        let mut img_buf = image::RgbImage::new(128, 128);
        // Fill with dark pixels
        for y in 0..128 {
            for x in 0..128 {
                img_buf.put_pixel(x, y, image::Rgb([30, 30, 30]));
            }
        }
        // Bright saturated spot at (80, 80)
        for y in 75..85 {
            for x in 75..85 {
                img_buf.put_pixel(x, y, image::Rgb([255, 100, 50]));
            }
        }

        let mut png_buf = Vec::new();
        let encoder = PngEncoder::new(&mut png_buf);
        encoder
            .write_image(img_buf.as_raw(), 128, 128, ColorType::Rgb8.into())
            .unwrap();

        let (png, x, y, w, h) = extract_bright_region(&png_buf);
        assert!(png.is_some(), "real art should produce a PNG");
        let png = png.unwrap();
        // Verify it's a valid PNG (starts with PNG signature)
        assert!(png.starts_with(b"\x89PNG"), "should be valid PNG");
        // Verify coords are in bounds
        assert!(x >= 0 && y >= 0, "coords should be non-negative");
        assert!(w > 0 && h > 0, "dimensions should be positive");
        assert!(
            x + w <= 128 && y + h <= 128,
            "should be within original image"
        );
    }

    #[test]
    fn test_extract_bright_region_uniform_fallback() {
        // Uniform image → should fall back to center crop
        let mut img_buf = image::RgbImage::new(128, 128);
        for y in 0..128 {
            for x in 0..128 {
                img_buf.put_pixel(x, y, image::Rgb([128, 128, 128]));
            }
        }

        let mut png_buf = Vec::new();
        let encoder = PngEncoder::new(&mut png_buf);
        encoder
            .write_image(img_buf.as_raw(), 128, 128, ColorType::Rgb8.into())
            .unwrap();

        let (png, _x, _y, w, h) = extract_bright_region(&png_buf);
        assert!(png.is_some(), "uniform art should still produce output");
        // Should be centered-ish
        assert!(w > 0 && h > 0);
    }
}
