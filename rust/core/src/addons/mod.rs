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
        ];
        for ip_str in pass_cases {
            let ip: IpAddr = ip_str.parse().unwrap();
            assert!(!is_private_ip(ip), "should pass: {ip_str}");
        }
    }
}
