//! Boolean filter engine — ported from Python `filter_engine.py`.
//!
//! Pure logic: tokenizer + recursive-descent parser → AST → evaluator.
//! No `boolean`-algebra crate; hand-rolled. Behavioral parity with the
//! Python engine is the contract (same parses, same eval, same errors,
//! same quirks).

use std::collections::{HashMap, HashSet};

// ── Error type ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum FilterError {
    #[error("Query cannot be empty")]
    EmptyQuery,
    #[error("Query too complex: maximum 50 terms allowed")]
    TooComplex,
    #[error("Invalid query syntax: {0}")]
    SyntaxError(String),
}

// ── AST ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Tag(String),
    Not(Box<Expr>),
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Ident(String),
    Amp,
    Pipe,
    Tilde,
    LParen,
    RParen,
}

/// Count identifier-pattern matches in the raw query string.
///
/// Python quirk: this counts `[a-zA-Z_][a-zA-Z0-9_]*` on the raw string,
/// which includes operator words (AND/OR/NOT) and words inside quotes.
/// We must replicate this exact behavior for parity.
fn count_raw_identifiers(query: &str) -> usize {
    let mut count = 0;
    let bytes = query.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b.is_ascii_lowercase()
            || b.is_ascii_uppercase()
            || b == b'_'
            || (b.is_ascii_digit() && i > 0 && is_ident_start(bytes[i - 1]))
        {
            if b.is_ascii_lowercase() || b.is_ascii_uppercase() || b == b'_' {
                // Start of a new identifier
                count += 1;
                i += 1;
                // Consume rest of identifier
                while i < bytes.len() && is_ident_char(bytes[i]) {
                    i += 1;
                }
            } else {
                i += 1;
            }
        } else {
            i += 1;
        }
    }
    count
}

fn is_ident_start(b: u8) -> bool {
    b.is_ascii_lowercase() || b.is_ascii_uppercase() || b == b'_'
}

fn is_ident_char(b: u8) -> bool {
    is_ident_start(b) || b.is_ascii_digit()
}

/// Tokenize the processed query (after quote extraction + operator normalization).
///
/// The input has already had quoted strings replaced with QTAG placeholders
/// and word operators (AND/OR/NOT) replaced with `&`/`|`/`~`.
fn tokenize(processed: &str) -> Result<Vec<Token>, FilterError> {
    let mut tokens = Vec::new();
    let bytes = processed.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b' ' | b'\t' | b'\n' | b'\r' => {
                i += 1;
            }
            b'&' => {
                tokens.push(Token::Amp);
                i += 1;
            }
            b'|' => {
                tokens.push(Token::Pipe);
                i += 1;
            }
            b'~' => {
                tokens.push(Token::Tilde);
                i += 1;
            }
            b'(' => {
                tokens.push(Token::LParen);
                i += 1;
            }
            b')' => {
                tokens.push(Token::RParen);
                i += 1;
            }
            b if is_ident_start(b) => {
                let start = i;
                i += 1;
                while i < bytes.len() && is_ident_char(bytes[i]) {
                    i += 1;
                }
                let word = &processed[start..i];
                tokens.push(Token::Ident(word.to_string()));
            }
            other => {
                return Err(FilterError::SyntaxError(format!(
                    "Unexpected character: '{}'",
                    other as char
                )));
            }
        }
    }
    Ok(tokens)
}

/// Extract quoted strings, replace with QTAG placeholders, normalize
/// word operators to symbols.
///
/// Returns `Ok((processed_string, quoted_tags_map))` on success.
/// Returns `Err(FilterError::SyntaxError)` if an unterminated quote is found.
fn preprocess(query: &str) -> Result<(String, HashMap<String, String>), FilterError> {
    let mut quoted_tags: HashMap<String, String> = HashMap::new();
    let mut placeholder_counter: usize = 0;
    let mut result = String::with_capacity(query.len());
    let bytes = query.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'"' || bytes[i] == b'\'' {
            let quote = bytes[i];
            i += 1; // skip opening quote
            let start = i;
            while i < bytes.len() && bytes[i] != quote {
                i += 1;
            }
            if i >= bytes.len() {
                return Err(FilterError::SyntaxError(format!(
                    "Unterminated quote: expected closing '{}'",
                    quote as char
                )));
            }
            if i == start {
                return Err(FilterError::SyntaxError(
                    "Empty quoted string".to_string(),
                ));
            }
            let inner = query[start..i].trim().to_lowercase();
            i += 1; // skip closing quote
            let placeholder = format!("QTAG{}", placeholder_counter);
            quoted_tags.insert(placeholder.clone(), inner);
            result.push_str(&placeholder);
            placeholder_counter += 1;
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }

    // Normalize word operators (case-insensitive, word-boundary)
    let processed = normalize_word_operators(&result);
    Ok((processed, quoted_tags))
}

/// Replace AND/OR/NOT word operators with `&`/`|`/`~`, respecting word boundaries.
fn normalize_word_operators(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        // Check for word-boundary delimited operators
        let remaining = &input[i..];
        let upper: String = remaining.chars().take(3).collect::<String>().to_uppercase();

        let (op_len, op_char) = if upper.starts_with("AND")
            && is_word_boundary_after(input, i + 3)
            && is_word_boundary_before(input, i)
        {
            (3, '&')
        } else if upper.starts_with("NOT")
            && is_word_boundary_after(input, i + 3)
            && is_word_boundary_before(input, i)
        {
            (3, '~')
        } else if upper.starts_with("OR")
            && remaining.len() >= 2
            && is_word_boundary_after(input, i + 2)
            && is_word_boundary_before(input, i)
        {
            (2, '|')
        } else {
            (0, '\0')
        };

        if op_len > 0 {
            result.push(op_char);
            i += op_len;
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }

    result
}

fn is_word_boundary_before(input: &str, pos: usize) -> bool {
    if pos == 0 {
        return true;
    }
    let b = input.as_bytes()[pos - 1];
    !is_ident_char(b)
}

fn is_word_boundary_after(input: &str, pos: usize) -> bool {
    if pos >= input.len() {
        return true;
    }
    let b = input.as_bytes()[pos];
    !is_ident_char(b)
}

// ── Recursive-descent parser ──────────────────────────────────────────────────
//
// Grammar (precedence: NOT > AND > OR):
//   expr     = or_expr
//   or_expr  = and_expr ( '|' and_expr )*
//   and_expr = unary ( '&' unary )*
//   unary    = '~' unary | primary
//   primary  = IDENT | '(' expr ')'

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn advance(&mut self) -> Option<Token> {
        if self.pos < self.tokens.len() {
            let tok = self.tokens[self.pos].clone();
            self.pos += 1;
            Some(tok)
        } else {
            None
        }
    }

    fn parse_expr(&mut self) -> Result<Expr, FilterError> {
        self.parse_or()
    }

    fn parse_or(&mut self) -> Result<Expr, FilterError> {
        let mut left = self.parse_and()?;
        while self.peek() == Some(&Token::Pipe) {
            self.advance();
            let right = self.parse_and()?;
            left = Expr::Or(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<Expr, FilterError> {
        let mut left = self.parse_unary()?;
        while self.peek() == Some(&Token::Amp) {
            self.advance();
            let right = self.parse_unary()?;
            left = Expr::And(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Expr, FilterError> {
        if self.peek() == Some(&Token::Tilde) {
            self.advance();
            let operand = self.parse_unary()?;
            Ok(Expr::Not(Box::new(operand)))
        } else {
            self.parse_primary()
        }
    }

    fn parse_primary(&mut self) -> Result<Expr, FilterError> {
        match self.advance() {
            Some(Token::Ident(name)) => Ok(Expr::Tag(name)),
            Some(Token::LParen) => {
                let expr = self.parse_expr()?;
                match self.advance() {
                    Some(Token::RParen) => Ok(expr),
                    _ => Err(FilterError::SyntaxError(
                        "Expected closing parenthesis".to_string(),
                    )),
                }
            }
            Some(other) => Err(FilterError::SyntaxError(format!(
                "Unexpected token: {:?}",
                other
            ))),
            None => Err(FilterError::SyntaxError(
                "Unexpected end of input".to_string(),
            )),
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Parse a filter query string into an AST and a quoted-tag map.
///
/// Returns `(expression, quoted_tags)` where `quoted_tags` maps
/// `QTAG{n}` placeholders to their lowercased, trimmed inner text.
pub fn parse(query: &str) -> Result<(Expr, HashMap<String, String>), FilterError> {
    // Validate non-empty
    if query.trim().is_empty() {
        return Err(FilterError::EmptyQuery);
    }

    // Complexity cap: count raw identifier tokens (the Python quirk)
    let atom_count = count_raw_identifiers(query);
    if atom_count > 50 {
        return Err(FilterError::TooComplex);
    }

    // Preprocess: extract quotes, normalize operators
    let (processed, quoted_tags) = preprocess(query)?;

    // Tokenize
    let tokens = tokenize(&processed)?;

    // Parse
    let mut parser = Parser::new(tokens);
    let expr = parser.parse_expr()?;

    // Ensure all tokens consumed
    if parser.pos < parser.tokens.len() {
        return Err(FilterError::SyntaxError(format!(
            "Unexpected trailing tokens starting at {:?}",
            parser.tokens[parser.pos]
        )));
    }

    Ok((expr, quoted_tags))
}

/// Evaluate a parsed expression against a song's tag set.
///
/// `quoted_tags` maps QTAG placeholders to their resolved tag names.
/// `tag_set` is the song's complete lowercased tag set.
pub fn evaluate(
    expr: &Expr,
    quoted_tags: &HashMap<String, String>,
    tag_set: &HashSet<String>,
) -> bool {
    match expr {
        Expr::Tag(name) => {
            let tag_name = if let Some(resolved) = quoted_tags.get(name) {
                resolved.clone()
            } else {
                name.to_lowercase()
            };
            tag_set.contains(&tag_name)
        }
        Expr::Not(inner) => !evaluate(inner, quoted_tags, tag_set),
        Expr::And(left, right) => {
            evaluate(left, quoted_tags, tag_set) && evaluate(right, quoted_tags, tag_set)
        }
        Expr::Or(left, right) => {
            evaluate(left, quoted_tags, tag_set) || evaluate(right, quoted_tags, tag_set)
        }
    }
}

/// Build a complete tag set from CSV strings.
///
/// Combines explicit tag names (`tag_names_csv`) and playlist names
/// (`playlist_names_csv` in `id:name` format). All lowercased + trimmed.
pub fn build_tag_set(
    tag_names_csv: Option<&str>,
    playlist_names_csv: Option<&str>,
) -> HashSet<String> {
    let mut tags = HashSet::new();
    if let Some(csv) = tag_names_csv {
        for name in csv.split(',') {
            let trimmed = name.trim().to_lowercase();
            if !trimmed.is_empty() {
                tags.insert(trimmed);
            }
        }
    }
    if let Some(csv) = playlist_names_csv {
        for item in csv.split(',') {
            let name = if let Some((_id, name)) = item.split_once(':') {
                name.trim().to_lowercase()
            } else {
                item.trim().to_lowercase()
            };
            if !name.is_empty() {
                tags.insert(name);
            }
        }
    }
    tags
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: parse + evaluate with a tag set, return whether matched.
    fn matches(query: &str, tags: &[&str]) -> bool {
        let (expr, qt) = parse(query).unwrap();
        let tag_set: HashSet<String> = tags.iter().map(|t| t.to_string()).collect();
        evaluate(&expr, &qt, &tag_set)
    }

    /// Helper: parse + evaluate, expect error.
    fn parse_err(query: &str) -> FilterError {
        parse(query).unwrap_err()
    }

    // ── Basic matching (ported from test_filter_engine.py) ─────────────────

    #[test]
    fn test_unquoted_tag_match() {
        assert!(matches("fast", &["fast"]));
        assert!(!matches("fast", &["slow"]));
    }

    #[test]
    fn test_quoted_tag_match() {
        // Sidebar-click code path: always-quoted query
        assert!(matches("\"fast\"", &["fast"]));
        assert!(!matches("\"fast\"", &["slow"]));
    }

    #[test]
    fn test_multiword_quoted_tag() {
        assert!(matches("\"easy listening\"", &["easy listening"]));
        assert!(!matches("\"easy listening\"", &["rock"]));
    }

    #[test]
    fn test_case_insensitive_unquoted() {
        assert!(matches("FAST", &["fast"]));
        assert!(matches("Fast", &["fast"]));
    }

    #[test]
    fn test_case_insensitive_quoted() {
        assert!(matches("\"FAST\"", &["fast"]));
    }

    #[test]
    fn test_no_match_returns_empty() {
        assert!(!matches("\"chill\"", &["fast"]));
    }

    // ── Boolean operators ──────────────────────────────────────────────────

    #[test]
    fn test_boolean_and() {
        assert!(matches("\"fast\" AND \"gym\"", &["fast", "gym"]));
        assert!(!matches("\"fast\" AND \"gym\"", &["fast"]));
        assert!(!matches("\"fast\" AND \"gym\"", &["gym"]));
    }

    #[test]
    fn test_boolean_or() {
        assert!(matches("\"fast\" OR \"anime\"", &["fast"]));
        assert!(matches("\"fast\" OR \"anime\"", &["anime"]));
        assert!(matches("\"fast\" OR \"anime\"", &["fast", "anime"]));
        assert!(!matches("\"fast\" OR \"anime\"", &["slow"]));
    }

    #[test]
    fn test_boolean_not() {
        assert!(!matches("\"fast\" AND NOT \"anime\"", &["fast", "anime"]));
        assert!(matches("\"fast\" AND NOT \"anime\"", &["fast"]));
    }

    #[test]
    fn test_boolean_and_not_compound() {
        assert!(!matches(
            "\"fast\" AND NOT (\"gym\" OR \"anime\")",
            &["fast", "gym"]
        ));
        assert!(!matches(
            "\"fast\" AND NOT (\"gym\" OR \"anime\")",
            &["fast", "anime"]
        ));
        assert!(matches(
            "\"fast\" AND NOT (\"gym\" OR \"anime\")",
            &["fast"]
        ));
    }

    // ── Edge cases (Python test suite) ─────────────────────────────────────

    #[test]
    fn test_empty_query_raises() {
        assert_eq!(parse_err(""), FilterError::EmptyQuery);
        assert_eq!(parse_err("   "), FilterError::EmptyQuery);
    }

    #[test]
    fn test_invalid_syntax_raises() {
        // "AND" alone → syntax error
        assert!(matches!(parse_err("AND"), FilterError::SyntaxError(_)));
    }

    #[test]
    fn test_song_with_no_tags_excluded() {
        assert!(matches("\"fast\"", &["fast"]));
        // Empty tag set — no match
        assert!(!matches("\"fast\"", &[]));
    }

    #[test]
    fn test_multiple_tags_on_song() {
        assert!(matches(
            "\"fast\" AND \"gym\" AND \"rock\"",
            &["fast", "gym", "rock"]
        ));
    }

    // ── Additional edge cases (parity with Python behavior) ────────────────

    #[test]
    fn test_mixed_operators() {
        // a & b AND c should work (all equivalent)
        assert!(matches("a & b AND c", &["a", "b", "c"]));
        assert!(!matches("a & b AND c", &["a", "b"]));
    }

    #[test]
    fn test_not_precedence() {
        // NOT a OR b = (NOT a) OR b
        assert!(matches("NOT a OR b", &["b"]));
        assert!(!matches("NOT a OR b", &["a"]));
        assert!(matches("NOT a OR b", &["a", "b"]));
    }

    #[test]
    fn test_nested_parens() {
        assert!(matches("(a OR b) AND (c OR d)", &["a", "c"]));
        assert!(matches("(a OR b) AND (c OR d)", &["b", "d"]));
        assert!(!matches("(a OR b) AND (c OR d)", &["a"]));
    }

    #[test]
    fn test_single_quoted_tag() {
        assert!(matches("'my tag'", &["my tag"]));
    }

    #[test]
    fn test_tilde_not() {
        assert!(matches("a & ~b", &["a"]));
        assert!(!matches("a & ~b", &["a", "b"]));
    }

    #[test]
    fn test_double_not() {
        assert!(matches("NOT NOT a", &["a"]));
        assert!(!matches("NOT NOT a", &[]));
    }

    #[test]
    fn test_trailing_operator_errors() {
        assert!(matches!(parse_err("a AND"), FilterError::SyntaxError(_)));
    }

    #[test]
    fn test_complexity_cap() {
        // 51 identifiers → too complex
        let q = (0..51)
            .map(|i| format!("tag{}", i))
            .collect::<Vec<_>>()
            .join(" AND ");
        assert_eq!(parse_err(&q), FilterError::TooComplex);
    }

    #[test]
    fn test_complexity_cap_quoted_count() {
        // Quoted words count toward complexity (Python quirk)
        // "hello world" AND "foo bar" → 5 identifiers (hello, world, AND, foo, bar)
        // Wait, after preprocess, AND becomes & (not an identifier).
        // But the raw count happens BEFORE preprocessing.
        // "hello world" AND "foo bar"
        // Raw identifiers: hello, world, AND, foo, bar = 5
        assert!(matches(
            "\"hello world\" AND \"foo bar\"",
            &["hello world", "foo bar"]
        ));
    }

    #[test]
    fn test_complexity_cap_exact_50() {
        // Exactly 50 should pass
        let _q = (0..25)
            .map(|i| format!("a{} AND b{}", i, i))
            .collect::<Vec<_>>()
            .join(" ");
        // Each "aX AND bY" has 3 identifiers (aX, AND, bY), but AND is an operator word
        // Actually raw count: a0, AND, b0, a1, AND, b1, ... = 75 identifiers
        // Let me construct a simpler one
        // 25 tags + 24 AND operators + 1 tag = 50 identifiers
        let tags: Vec<String> = (0..25).map(|i| format!("t{}", i)).collect();
        let q = tags.join(" AND ");
        // 25 tags + 24 "AND" = 49 identifiers
        assert!(matches(
            &q,
            &tags.iter().map(|s| s.as_str()).collect::<Vec<_>>()
        ));
    }

    #[test]
    fn test_build_tag_set_basic() {
        let ts = build_tag_set(Some("rock,pop, jazz"), None);
        assert!(ts.contains("rock"));
        assert!(ts.contains("pop"));
        assert!(ts.contains("jazz"));
    }

    #[test]
    fn test_build_tag_set_playlists() {
        let ts = build_tag_set(None, Some("1:Workout,2:Chill Mix"));
        assert!(ts.contains("workout"));
        assert!(ts.contains("chill mix"));
    }

    #[test]
    fn test_build_tag_set_combined() {
        let ts = build_tag_set(Some("rock"), Some("1:Workout"));
        assert!(ts.contains("rock"));
        assert!(ts.contains("workout"));
        assert_eq!(ts.len(), 2);
    }

    #[test]
    fn test_build_tag_set_none() {
        let ts = build_tag_set(None, None);
        assert!(ts.is_empty());
    }

    #[test]
    fn test_or_associativity() {
        // a OR b OR c = (a OR b) OR c — left-associative
        assert!(matches("a OR b OR c", &["a"]));
        assert!(matches("a OR b OR c", &["b"]));
        assert!(matches("a OR b OR c", &["c"]));
        assert!(!matches("a OR b OR c", &["d"]));
    }

    #[test]
    fn test_and_associativity() {
        assert!(matches("a & b & c", &["a", "b", "c"]));
        assert!(!matches("a & b & c", &["a", "b"]));
    }

    #[test]
    fn test_unmatched_closing_paren() {
        assert!(matches!(parse_err(")"), FilterError::SyntaxError(_)));
    }

    #[test]
    fn test_unmatched_opening_paren() {
        assert!(matches!(parse_err("(a"), FilterError::SyntaxError(_)));
    }

    // ── Bare NOT(group) — N29 regression guards ─────────────────────────

    #[test]
    fn test_bare_not_or_group_matches() {
        // NOT (rock OR jazz) should match a song tagged only {chill}
        assert!(matches("NOT (\"rock\" OR \"jazz\")", &["chill"]));
    }

    #[test]
    fn test_bare_not_or_group_excludes() {
        // NOT (rock OR jazz) should NOT match a song tagged {rock}
        assert!(!matches("NOT (\"rock\" OR \"jazz\")", &["rock"]));
    }

    #[test]
    fn test_bare_not_and_group() {
        // NOT (gym AND anime) should match {gym} (has gym but not both)
        assert!(matches("NOT (\"gym\" AND \"anime\")", &["gym"]));
        assert!(!matches("NOT (\"gym\" AND \"anime\")", &["gym", "anime"]));
    }

    // ── Unterminated quotes — N32 parity guards ─────────────────────────────

    #[test]
    fn test_unterminated_double_quote_errors() {
        // An unclosed double quote must be rejected (not silently accepted)
        assert!(matches!(
            parse_err("\"fast"),
            FilterError::SyntaxError(_)
        ));
    }

    #[test]
    fn test_unterminated_single_quote_errors() {
        // An unclosed single quote must be rejected
        assert!(matches!(
            parse_err("'chill"),
            FilterError::SyntaxError(_)
        ));
    }

    #[test]
    fn test_unterminated_quote_with_and_errors() {
        // Unclosed quote in compound query must be rejected
        assert!(matches!(
            parse_err("rock AND \"fast"),
            FilterError::SyntaxError(_)
        ));
    }

    #[test]
    fn test_valid_closed_quotes_still_work() {
        // Closed quotes must still parse correctly (no regression)
        assert!(matches("\"multi word tag\"", &["multi word tag"]));
        assert!(matches("'chill'", &["chill"]));
    }

    // ── Empty quotes — N32-FIX parity guards ─────────────────────────────────

    #[test]
    fn test_empty_double_quote_errors() {
        // Zero-length inner span: "" must be rejected (Python parity)
        assert!(matches!(
            parse_err("\"\""),
            FilterError::SyntaxError(_)
        ));
    }

    #[test]
    fn test_empty_single_quote_errors() {
        // Zero-length inner span: '' must be rejected (Python parity)
        assert!(matches!(
            parse_err("''"),
            FilterError::SyntaxError(_)
        ));
    }

    #[test]
    fn test_whitespace_only_quoted_still_ok() {
        // Whitespace-only inner (≥1 raw char) must still parse — no over-reject
        assert!(matches("\"   \"", &[""]));
        assert!(matches("\" \"", &[""]));
    }
}
