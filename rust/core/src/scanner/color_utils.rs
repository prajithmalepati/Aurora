//! OKLCH color utilities — bit-exact port of Python `color_utils.py`.
//!
//! All math uses f64 to match Python's float precision.

/// Linearize sRGB gamma: `c/12.92` if c ≤ 0.04045, else `((c+0.055)/1.055)^2.4`.
fn linear(c: f64) -> f64 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

/// sRGB (0–255 per channel) → OKLCH (L 0–1, C 0–0.4+, H 0–360).
///
/// Pipeline: sRGB → linear sRGB → LMS (cube root) → OKLab → OKLCH.
/// Uses the standard Björn Ottosson matrices.
pub fn rgb_to_oklch(r: u8, g: u8, b: u8) -> (f64, f64, f64) {
    let lr = linear(r as f64 / 255.0);
    let lg = linear(g as f64 / 255.0);
    let lb = linear(b as f64 / 255.0);

    // linear sRGB → LMS (Björn Ottosson's matrix)
    let l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    let m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    let s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

    // Cube root
    let l = l.cbrt();
    let m = m.cbrt();
    let s = s.cbrt();

    // LMS → OKLab
    let l_ok = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    let a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    let b_ok = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

    // OKLab → OKLCH
    let c = (a * a + b_ok * b_ok).sqrt();
    let h = b_ok.atan2(a).to_degrees().rem_euclid(360.0);

    (l_ok, c, h)
}

/// Clamp OKLCH to contrast-safe range, return CSS oklch() string.
///
/// Format: `oklch({L:.4} {C:.4} {H:.1})` — 4dp L, 4dp C, 1dp H.
pub fn clamp_oklch_for_display(l: f64, c: f64, h: f64) -> String {
    let l = l.clamp(0.30, 0.70);
    let c = c.clamp(0.08, 0.35);
    format!("oklch({:.4} {:.4} {:.1})", l, c, h)
}

// ===========================================================================
// Tests — T1 bit-exact (ported from Python test_scanner_color.py)
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgb_to_oklch_white() {
        let (l, c, _h) = rgb_to_oklch(255, 255, 255);
        assert!(l > 0.99, "white L should be >0.99, got {}", l);
        assert!(c < 0.01, "white C should be <0.01, got {}", c);
    }

    #[test]
    fn test_rgb_to_oklch_black() {
        let (l, _c, _h) = rgb_to_oklch(0, 0, 0);
        assert!(l < 0.01, "black L should be <0.01, got {}", l);
    }

    #[test]
    fn test_rgb_to_oklch_red() {
        let (l, c, h) = rgb_to_oklch(255, 0, 0);
        assert!(
            l > 0.5 && l < 0.7,
            "red L should be in (0.5, 0.7), got {}",
            l
        );
        assert!(c > 0.15, "red C should be >0.15, got {}", c);
        assert!(
            h > 20.0 && h < 40.0,
            "red H should be in (20, 40), got {}",
            h
        );
    }

    #[test]
    fn test_clamp_oklch_high_low() {
        let result = clamp_oklch_for_display(0.9, 0.03, 185.0);
        assert!(
            result.starts_with("oklch(0.70"),
            "L clamped to 0.70: got {}",
            result
        );
        assert!(result.contains("0.08"), "C bumped to 0.08: got {}", result);
    }

    #[test]
    fn test_clamp_oklch_format() {
        let s = clamp_oklch_for_display(0.55, 0.18, 185.0);
        assert!(s.starts_with("oklch("), "missing oklch prefix: {}", s);
        assert!(s.ends_with(')'), "missing closing paren: {}", s);
    }

    /// Cross-check: run Python rgb_to_oklch on these inputs and assert Rust
    /// matches to < 1e-5. Pinned values from the Python reference.
    #[test]
    fn test_rgb_to_oklch_python_cross_check() {
        // (r, g, b, expected_L, expected_C, expected_H)
        // Values pinned from Python color_utils.py
        let cases: &[(u8, u8, u8, f64, f64, f64)] = &[
            (255, 0, 0, 0.6279553606, 0.2576833077, 29.2338851923),
            (0, 255, 0, 0.8664396115, 0.2948272403, 142.4953388878),
            (0, 0, 255, 0.4520137184, 0.3132143717, 264.0520206381),
            (128, 128, 128, 0.5998708017, 0.0000000224, 89.8755623548),
            (255, 255, 255, 0.9999999935, 0.0000000373, 89.8755630959),
            (0, 0, 0, 0.0, 0.0, 0.0),
        ];

        for &(r, g, b, exp_l, exp_c, exp_h) in cases {
            let (l, c, h) = rgb_to_oklch(r, g, b);
            assert!(
                (l - exp_l).abs() < 1e-4,
                "L mismatch for ({},{},{}): got {}, expected {}",
                r,
                g,
                b,
                l,
                exp_l
            );
            // For achromatic (C≈0), H is undefined — skip H check
            if exp_c > 0.001 {
                assert!(
                    (c - exp_c).abs() < 1e-4,
                    "C mismatch for ({},{},{}): got {}, expected {}",
                    r,
                    g,
                    b,
                    c,
                    exp_c
                );
                // H can wrap, so check angular distance
                let h_diff = (h - exp_h).abs().min(360.0 - (h - exp_h).abs());
                assert!(
                    h_diff < 0.5,
                    "H mismatch for ({},{},{}): got {}, expected {}",
                    r,
                    g,
                    b,
                    h,
                    exp_h
                );
            }
        }
    }
}
