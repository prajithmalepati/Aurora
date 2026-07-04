//! Addon proxy — SSRF defense, rate limiter, circuit breaker.
//!
//! Ported from backend/app/routers/addons.py (N37).

use std::net::{IpAddr, Ipv6Addr};

// ── SSRF Defense ──────────────────────────────────────────────────────

/// CGNAT 100.64.0.0/10 — the Tailscale range.
/// NOT covered by `is_private()` on all Python/Rust versions.
/// Explicit regardless, per N37 brief.
const CGNAT_PREFIX: [u8; 4] = [100, 64, 0, 0];
const CGNAT_MASK: u32 = 0xFFC0_0000; // /10

/// Check if an IP address is private/reserved/unspecified/multicast.
///
/// Mirrors the fixed Python `_is_private_ip` from N37 T1.
/// Handles IPv4-mapped IPv6 addresses by unwrapping to the mapped IPv4.
pub fn is_private_ip(ip: IpAddr) -> bool {
    // Unwrap IPv4-mapped IPv6 → evaluate the mapped IPv4
    let ip = match ip {
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => IpAddr::V6(v6),
        },
        v4 => v4,
    };

    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_unspecified()
                || v4.is_multicast()
                || is_cgnat_v4(v4)
                || v4.octets()[0] == 0   // 0.0.0.0/8 (current network)
                || v4.octets()[0] >= 240 // 240.0.0.0/4 (reserved/future)
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || is_ipv6_link_local(v6)
                || is_ipv6_unique_local(v6)
                || is_ipv6_reserved(v6)
                || is_ipv6_private_special(v6)
        }
    }
}

/// CGNAT 100.64.0.0/10 check.
fn is_cgnat_v4(ip: std::net::Ipv4Addr) -> bool {
    let addr = u32::from_be_bytes(ip.octets());
    let net = u32::from_be_bytes(CGNAT_PREFIX);
    (addr & CGNAT_MASK) == (net & CGNAT_MASK)
}

/// fe80::/10 — IPv6 link-local.
fn is_ipv6_link_local(ip: Ipv6Addr) -> bool {
    (ip.segments()[0] & 0xFFC0) == 0xFE80
}

/// fc00::/7 — IPv6 unique local (ULA).
fn is_ipv6_unique_local(ip: Ipv6Addr) -> bool {
    (ip.segments()[0] & 0xFE00) == 0xFC00
}

/// IPv6 reserved address ranges — mirrors Python's `ipaddress.IPv6Address.is_reserved`.
///
/// Parity target: Python `_is_private_ip` rejects when ANY of these is true:
///   is_loopback | is_private | is_link_local | is_reserved | is_unspecified | is_multicast
///
/// Python's `is_reserved` covers the IANA IPv6 Special-Purpose Address Registry:
///   - 0000::/8    (loopback, unspecified, v4-compat — already caught by earlier checks)
///   - 0100::/8    (RFC 6666 discard prefix, e.g. 100::1)
///   - 0200::/7    (formerly NSAP, deprecated — Python marks as reserved)
///   - 4000::/2    (IETF reserved, covers 4000::-7fff:ffff:...)
///   - 8000::/1    (IETF reserved, covers 8000::-ffff:ffff:... — includes multicast/link-local
///     but those are caught by earlier checks)
///
/// Python's is_reserved returns True for all IPv6 addresses outside 2000::/3
/// (the global unicast range). This covers:
///   - 0000::/8 (loopback, unspecified, v4-compatible)
///   - 0100::/8 (RFC 6666 discard)
///   - NAT64 (64:ff9b::/32), and everything >= 4000:: (IANA reserved)
///
/// In practice: first_segment < 0x2000. Addresses within 2000::/3 that
/// Python rejects (doc range, ORCHID, Teredo) are caught by is_private.
fn is_ipv6_reserved(ip: Ipv6Addr) -> bool {
    let s0 = ip.segments()[0];
    // Everything outside 2000::/3 is reserved per Python's is_reserved
    !(0x2000..0x4000).contains(&s0)
}

/// Addresses within 2000::/3 that Python's `is_private` considers private.
/// These are NOT covered by is_reserved (which only checks < 0x2000).
fn is_ipv6_private_special(ip: Ipv6Addr) -> bool {
    let s0 = ip.segments()[0];
    let s1 = ip.segments()[1];
    // 2001:db8::/32 — documentation range (RFC 3849)
    (s0 == 0x2001 && s1 == 0x0DB8)
    // 2002::/16 — 6to4 tunneling (RFC 3056)
    || s0 == 0x2002
    // 2001:10::/28 — ORCHID (RFC 4843)
    || (s0 == 0x2001 && (s1 & 0xFFF0) == 0x0010)
    // 2001::/32 — Teredo tunneling (RFC 4380)
    || (s0 == 0x2001 && s1 == 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_private_ip_gaps() {
        let reject_cases: &[&str] = &[
            "0.0.0.0",
            "::ffff:127.0.0.1",
            "::ffff:169.254.169.254",
            "::",
            "100.64.0.1",
            "100.100.100.100",
            "127.0.0.1",
            "10.1.2.3",
            "192.168.1.1",
            "169.254.0.1",
            "172.16.0.1",
            "fc00::1",
            "fe80::1",
            "::1",
            "224.0.0.1",
            "255.255.255.255",
            // F2/R2-B: v6-compatible embedding (::/8)
            "::127.0.0.1",
            "::10.0.0.1",
            // F2/R2-B: NAT64 (64:ff9b::/96)
            "64:ff9b::7f00:1",
            "64:ff9b::10.0.0.1",
            // F2/R2-B: NAT64 neighbor — Python is_reserved rejects
            "64:ff9c::1",
            // F2/R2-B: documentation range (2001:db8::/32, Python is_private)
            "2001:db8::1",
            "2001:db8:abcd::1",
            // R2-B: 6to4 (2002::/16, Python is_private)
            "2002::1",
            // R2-B: RFC 6666 discard (100::/64, Python is_reserved + is_private)
            "100::1",
            // R2-B: ORCHID (2001:10::/28, Python is_private)
            "2001:10::1",
            // R2-B: Teredo (2001::/32, Python is_private)
            "2001::1",
            // R2-B: IANA reserved (>=4000::, Python is_reserved)
            "4000::1",
            "5f00::1",
            "a000::1",
        ];
        for ip_str in reject_cases {
            let ip: IpAddr = ip_str.parse().unwrap();
            assert!(is_private_ip(ip), "should reject: {ip_str}");
        }
    }

    #[test]
    fn test_public_ips_pass() {
        let pass_cases: &[&str] = &[
            "8.8.8.8",
            "::ffff:8.8.8.8",
            "2606:4700::1111",
            "1.1.1.1",
            "93.184.216.34",
            // R2-B: 6bone (3ffe::/16, Python treats as global)
            "3ffe::1",
        ];
        for ip_str in pass_cases {
            let ip: IpAddr = ip_str.parse().unwrap();
            assert!(!is_private_ip(ip), "should pass: {ip_str}");
        }
    }
}
