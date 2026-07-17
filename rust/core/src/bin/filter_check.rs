//! Minimal filter-check binary for cross-runtime testing.
//!
//! Usage: filter_check <query>
//! Exits 0 if the query parses successfully, 1 if it fails, 2 on usage error.
//! This is a test-only bridge — Vitest invokes it to verify chip-generated
//! queries are accepted by the real Rust filter engine.

use std::process;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: filter_check <query>");
        process::exit(2);
    }
    let query = &args[1];
    match aurora_core::filter::parse(query) {
        Ok(_) => {
            // Print the quoted_tags map for inspection
            let (_, quoted_tags) = aurora_core::filter::parse(query).unwrap();
            if !quoted_tags.is_empty() {
                for (k, v) in &quoted_tags {
                    println!("{}={}", k, v);
                }
            }
            process::exit(0);
        }
        Err(e) => {
            eprintln!("{}", e);
            process::exit(1);
        }
    }
}
