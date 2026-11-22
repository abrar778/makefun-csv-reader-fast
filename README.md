# Fast drop-in for csv-reader 1.0.0

Single-pass CSV reader matching csv-reader 1.0.0's output exactly (including its
broken-row policy: stray_cr, unterminated_quote, quote_junk, short_row, long_row).

- solve.js: dependency-free ES module, run(input) -> {columns, rows, errors}
- main.ts: harness driver (reads /input/cases.json, writes /output/answers.json)

Technique: char-code state machine; quoted bodies scanned with indexOf('"') jumps;
fields assembled with slice() (no per-character concatenation); V8 incremental
marking disabled as the house driver does.
