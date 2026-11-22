// Fast CSV reader v7: char-loop for unquoted fields (short, frequent) +
// indexOf('"') jump for quoted bodies (long) to skip per-char visits.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  const C_QUOTE = 34, C_COMMA = 44, C_LF = 10, C_CR = 13;

  while (true) {
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === C_LF) { pos++; line++; }
      else if (c === C_CR && pos + 1 < len && text.charCodeAt(pos + 1) === C_LF) { pos += 2; line++; }
      else break;
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = (header && columns === null) ? null : rows.length;

    const fields = [];
    let endedComma = false;
    let lastQuoted = false;

    do {
      if (text.charCodeAt(pos) === C_QUOTE) {
        // ---- quoted field: jump between quotes with indexOf ----
        lastQuoted = true;
        const open = pos;
        const openLine = line;
        pos++;
        let val = '';
        let segStart = pos;
        let closed = false;
        while (true) {
          const q = text.indexOf('"', pos);
          if (q === -1) { pos = len; break; }
          if (q + 1 < len && text.charCodeAt(q + 1) === C_QUOTE) {
            val += text.slice(segStart, q) + '"';
            pos = q + 2; segStart = pos;
            continue;
          }
          val += text.slice(segStart, q);
          pos = q + 1; closed = true;
          break;
        }
        // count lines inside the quoted body: CR or LF occurrences (CRLF counts once)
        if (val.length > 0) {
          const nlf = val.indexOf('\n');
          const ncr = val.indexOf('\r');
          if (nlf !== -1 || ncr !== -1) {
            if (ncr !== -1) val = val.replace(/\r\n?/g, '\n');
            let nl = 0;
            for (let k = val.indexOf('\n'); k !== -1; k = val.indexOf('\n', k + 1)) nl++;
            line += nl;
          }
        }
        if (!closed) {
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          let v = '"';
          let s2 = pos;
          let done = false;
          while (pos < len) {
            const c = text.charCodeAt(pos);
            if (c === C_COMMA) { v += text.slice(s2, pos); pos++; endedComma = true; done = true; break; }
            if (c === C_LF) { v += text.slice(s2, pos); pos++; line++; done = true; break; }
            if (c === C_CR) {
              if (pos + 1 < len && text.charCodeAt(pos + 1) === C_LF) {
                v += text.slice(s2, pos); pos += 2; line++; done = true; break;
              }
              v += text.slice(s2, pos);
              errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
              pos++; s2 = pos;
              continue;
            }
            pos++;
          }
          if (!done) v += text.slice(s2, pos);
          fields.push(v);
          continue;
        }
        if (pos >= len) { endedComma = false; fields.push(val); continue; }
        const c2 = text.charCodeAt(pos);
        if (c2 === C_COMMA) { pos++; endedComma = true; fields.push(val); continue; }
        if (c2 === C_LF) { pos++; line++; endedComma = false; fields.push(val); continue; }
        if (c2 === C_CR && pos + 1 < len && text.charCodeAt(pos + 1) === C_LF) {
          pos += 2; line++; endedComma = false; fields.push(val); continue;
        }
        // junk after closing quote
        let added = 0;
        let s3 = pos;
        let done3 = false;
        while (pos < len) {
          const c = text.charCodeAt(pos);
          if (c === C_COMMA) { val += text.slice(s3, pos); pos++; added += pos - s3 - 1; endedComma = true; done3 = true; break; }
          if (c === C_LF) { val += text.slice(s3, pos); pos++; added += pos - s3 - 1; line++; endedComma = false; done3 = true; break; }
          if (c === C_CR) {
            if (pos + 1 < len && text.charCodeAt(pos + 1) === C_LF) {
              val += text.slice(s3, pos); pos += 2; line++; endedComma = false; done3 = true; break;
            }
            val += text.slice(s3, pos);
            added += pos - s3;
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            pos++; s3 = pos;
            continue;
          }
          added++;
          pos++;
        }
        if (!done3) { val += text.slice(s3, pos); added += pos - s3; endedComma = false; }
        if (added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        fields.push(val);
        continue;
      } else {
        // ---- unquoted field: plain char loop ----
        lastQuoted = false;
        const start = pos;
        let ended = false;
        let value;
        while (pos < len) {
          const c = text.charCodeAt(pos);
          if (c === C_COMMA) { pos++; endedComma = true; value = text.slice(start, pos - 1); ended = true; break; }
          if (c === C_LF) { pos++; line++; endedComma = false; value = text.slice(start, pos - 1); ended = true; break; }
          if (c === C_CR) {
            if (pos + 1 < len && text.charCodeAt(pos + 1) === C_LF) {
              pos += 2; line++; endedComma = false; value = text.slice(start, pos - 2); ended = true; break;
            }
            // lone CR (rare)
            let seg = text.slice(start, pos);
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            pos++;
            let s4 = pos;
            let done4 = false;
            while (pos < len) {
              const c3 = text.charCodeAt(pos);
              if (c3 === C_COMMA) { seg += text.slice(s4, pos); pos++; endedComma = true; done4 = true; break; }
              if (c3 === C_LF) { seg += text.slice(s4, pos); pos++; line++; endedComma = false; done4 = true; break; }
              if (c3 === C_CR) {
                if (pos + 1 < len && text.charCodeAt(pos + 1) === C_LF) {
                  seg += text.slice(s4, pos); pos += 2; line++; endedComma = false; done4 = true; break;
                }
                seg += text.slice(s4, pos);
                errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
                pos++; s4 = pos;
                continue;
              }
              pos++;
            }
            if (!done4) seg += text.slice(s4, pos);
            value = seg;
            ended = true;
            break;
          }
          pos++;
        }
        if (!ended) { value = text.slice(start, pos); endedComma = false; }
        fields.push(value);
        continue;
      }
    } while (endedComma);

    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
