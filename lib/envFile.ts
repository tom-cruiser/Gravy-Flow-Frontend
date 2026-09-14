/**
 * Parser + normaliser for pasted or uploaded `.env` files.
 *
 * The rules here intentionally mirror the Go control plane
 * (cmd/api/envs.go: normalizeEnvKey / validateEnvVar / isSensitiveKey) so that
 * anything this module reports as `valid` is guaranteed to survive the
 * server-side validation in POST /apps/:id/env/bulk. Keys that only *nearly*
 * pass — `my-key`, `port `, `"DB_URL"` — are adapted into the POSIX shape the
 * backend requires rather than being rejected outright.
 */

export const ENV_FILE_MAX_BYTES = 512 * 1024;

/** Terms the Go backend treats as sensitive; kept in sync for preview masking. */
const SENSITIVE_TERMS = [
  'secret', 'password', 'token', 'key', 'auth', 'credential',
  'private', 'cert', 'pem', 'api', 'access', 'refresh',
];

const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type EnvEntryStatus = 'ok' | 'adapted' | 'duplicate' | 'invalid';

export type ParsedEnvEntry = {
  /** Normalised key that will be sent to the API. */
  key: string;
  /** Key exactly as it appeared in the file, for the diff column. */
  originalKey: string;
  value: string;
  /** 1-based line number in the source text. */
  line: number;
  status: EnvEntryStatus;
  /** Human-readable notes: what was adapted, or why the entry was dropped. */
  notes: string[];
  sensitive: boolean;
};

export type ParsedEnvFile = {
  entries: ParsedEnvEntry[];
  /** Entries that will actually be submitted (status 'ok' or 'adapted'). */
  importable: ParsedEnvEntry[];
  counts: Record<EnvEntryStatus, number>;
};

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_TERMS.some((term) => lower.includes(term));
}

/** Mask a value the way the drawer masks server-side secrets. */
export function previewValue(entry: ParsedEnvEntry): string {
  if (entry.value === '') return '(empty)';
  if (entry.sensitive) return '••••••';
  return entry.value.length > 48 ? `${entry.value.slice(0, 48)}…` : entry.value;
}

/**
 * Coerce a raw key into the POSIX shape the backend enforces.
 * Returns the adapted key plus a note for every transformation applied, so the
 * preview can tell the user exactly what changed before anything is saved.
 */
function adaptKey(rawKey: string): { key: string; notes: string[] } {
  const notes: string[] = [];
  let key = rawKey.trim();

  // Some exports wrap the key itself in quotes ("DB_URL"=...).
  const unquoted = key.replace(/^(['"])(.*)\1$/, '$2');
  if (unquoted !== key) {
    key = unquoted;
    notes.push('removed quotes around key');
  }

  // Dashes/dots/spaces are common in pasted configs but are not valid POSIX
  // env characters and break many shells, so fold them to underscores.
  const separated = key.replace(/[-.\s]+/g, '_');
  if (separated !== key) {
    key = separated;
    notes.push('replaced -, . and spaces with _');
  }

  const stripped = key.replace(/[^A-Za-z0-9_]/g, '');
  if (stripped !== key) {
    key = stripped;
    notes.push('dropped unsupported characters');
  }

  if (/^[0-9]/.test(key)) {
    key = `_${key}`;
    notes.push('prefixed _ (keys cannot start with a digit)');
  }

  // The backend uppercases on receipt; do it here so the preview shows the key
  // under the name it will actually be stored as.
  const upper = key.toUpperCase();
  if (upper !== key) {
    key = upper;
    notes.push('uppercased');
  }

  return { key, notes };
}

/** Unescape a double-quoted dotenv value. Single quotes are literal. */
function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\([nrtfbv\\'"])/g, (_match, char: string) => {
    switch (char) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'f': return '\f';
      case 'b': return '\b';
      case 'v': return '\v';
      default: return char;
    }
  });
}

/**
 * Read the value that starts at `rest` on line `index`, consuming following
 * lines when the value opens a quote that is not closed on the same line
 * (multi-line PEM keys and certificates arrive this way).
 * Returns the decoded value and the index of the last line consumed.
 */
function readValue(rest: string, lines: string[], index: number): { value: string; endIndex: number } {
  const trimmed = rest.trim();
  const quote = trimmed[0];

  if (quote === '"' || quote === "'") {
    const body = trimmed.slice(1);
    const closing = findClosingQuote(body, quote);
    if (closing >= 0) {
      const raw = body.slice(0, closing);
      return { value: quote === '"' ? unescapeDoubleQuoted(raw) : raw, endIndex: index };
    }

    // Unterminated on this line: keep appending lines until the quote closes.
    const collected = [body];
    for (let i = index + 1; i < lines.length; i += 1) {
      const line = lines[i];
      const end = findClosingQuote(line, quote);
      if (end >= 0) {
        collected.push(line.slice(0, end));
        const raw = collected.join('\n');
        return { value: quote === '"' ? unescapeDoubleQuoted(raw) : raw, endIndex: i };
      }
      collected.push(line);
    }

    // Never closed — treat the remainder of the file as the value rather than
    // silently dropping it.
    const raw = collected.join('\n');
    return { value: quote === '"' ? unescapeDoubleQuoted(raw) : raw, endIndex: lines.length - 1 };
  }

  // Unquoted: an unescaped ` #` starts an inline comment.
  const commentAt = trimmed.search(/(^|\s)#/);
  const value = commentAt >= 0 ? trimmed.slice(0, commentAt) : trimmed;
  return { value: value.trim(), endIndex: index };
}

function findClosingQuote(text: string, quote: string): number {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && quote === '"') {
      i += 1;
      continue;
    }
    if (text[i] === quote) return i;
  }
  return -1;
}

export function parseEnvFile(input: string): ParsedEnvFile {
  const lines = input.replace(/^﻿/, '').split(/\r?\n/);
  const entries: ParsedEnvEntry[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const startLine = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    // `export KEY=value` is valid in shell-sourced env files.
    const withoutExport = trimmed.replace(/^export\s+/, '');
    const separator = withoutExport.indexOf('=');

    if (separator < 0) {
      entries.push({
        key: '',
        originalKey: withoutExport,
        value: '',
        line: startLine,
        status: 'invalid',
        notes: ['no "=" found — expected KEY=value'],
        sensitive: false,
      });
      continue;
    }

    const originalKey = withoutExport.slice(0, separator);
    const { value, endIndex } = readValue(withoutExport.slice(separator + 1), lines, i);
    i = endIndex;

    const { key, notes } = adaptKey(originalKey);

    if (key === '' || !VALID_KEY.test(key)) {
      entries.push({
        key,
        originalKey: originalKey.trim(),
        value,
        line: startLine,
        status: 'invalid',
        notes: [key === '' ? 'key is empty' : `"${originalKey.trim()}" cannot be converted to a valid key`],
        sensitive: false,
      });
      continue;
    }

    entries.push({
      key,
      originalKey: originalKey.trim(),
      value,
      line: startLine,
      status: notes.length > 0 ? 'adapted' : 'ok',
      notes,
      sensitive: isSensitiveKey(key),
    });
  }

  // dotenv semantics: a later definition of the same key wins. Mark the earlier
  // ones so the user can see the file redefined something.
  const lastIndexByKey = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (entry.status === 'invalid') return;
    lastIndexByKey.set(entry.key, index);
  });
  entries.forEach((entry, index) => {
    if (entry.status === 'invalid') return;
    if (lastIndexByKey.get(entry.key) !== index) {
      entry.status = 'duplicate';
      entry.notes = [...entry.notes, 'redefined later in the file — this line is ignored'];
    }
  });

  const importable = entries.filter((entry) => entry.status === 'ok' || entry.status === 'adapted');
  const counts: Record<EnvEntryStatus, number> = { ok: 0, adapted: 0, duplicate: 0, invalid: 0 };
  entries.forEach((entry) => {
    counts[entry.status] += 1;
  });

  return { entries, importable, counts };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
