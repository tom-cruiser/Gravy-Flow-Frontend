import { describe, expect, it } from 'vitest';
import { adaptKey, chunk, isSensitiveKey, parseEnvFile, previewValue } from '@/lib/envFile';

describe('adaptKey', () => {
  it('leaves a valid POSIX key alone', () => {
    expect(adaptKey('DB_URL')).toEqual({ key: 'DB_URL', notes: [] });
  });

  it('adapts near-valid keys into the backend shape', () => {
    expect(adaptKey('"my-key"').key).toBe('MY_KEY');
    expect(adaptKey('port ').key).toBe('PORT');
    expect(adaptKey('1st.value').key).toBe('_1ST_VALUE');
  });
});

describe('parseEnvFile', () => {
  it('parses plain, quoted, exported and commented lines', () => {
    const { importable, counts } = parseEnvFile(
      [
        '# comment',
        'export PORT=3000',
        'NAME="hello\\nworld"',
        "RAW='a\\nb'",
        'MODE=prod # inline comment',
        '',
      ].join('\n'),
    );
    expect(counts.invalid).toBe(0);
    expect(Object.fromEntries(importable.map((e) => [e.key, e.value]))).toEqual({
      PORT: '3000',
      NAME: 'hello\nworld',
      RAW: 'a\\nb',
      MODE: 'prod',
    });
  });

  it('reads multi-line quoted values such as PEM keys', () => {
    const { importable } = parseEnvFile('KEY="-----BEGIN-----\nabc\n-----END-----"\nNEXT=1');
    expect(importable.map((e) => e.key)).toEqual(['KEY', 'NEXT']);
    expect(importable[0].value).toBe('-----BEGIN-----\nabc\n-----END-----');
  });

  it('keeps only the last definition of a duplicated key', () => {
    const { entries, importable, counts } = parseEnvFile('A=1\nA=2');
    expect(counts.duplicate).toBe(1);
    expect(entries[0].status).toBe('duplicate');
    expect(importable).toHaveLength(1);
    expect(importable[0].value).toBe('2');
  });

  it('flags lines without "=" and unconvertible keys as invalid', () => {
    const { counts, importable } = parseEnvFile('JUSTAWORD\n!!!=x');
    expect(counts.invalid).toBe(2);
    expect(importable).toHaveLength(0);
  });

  it('strips a UTF-8 BOM and handles CRLF', () => {
    const { importable } = parseEnvFile('﻿A=1\r\nB=2\r\n');
    expect(importable.map((e) => [e.key, e.value])).toEqual([['A', '1'], ['B', '2']]);
  });
});

describe('sensitive values', () => {
  it('detects sensitive keys and masks their preview', () => {
    expect(isSensitiveKey('STRIPE_SECRET')).toBe(true);
    expect(isSensitiveKey('PORT')).toBe(false);
    const [entry] = parseEnvFile('DB_PASSWORD=hunter2').importable;
    expect(previewValue(entry)).toBe('••••••');
  });
});

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
