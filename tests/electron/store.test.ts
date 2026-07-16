import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeScore, readHighScore, writeHighScore } from '../../electron/store';

describe('sanitizeScore', () => {
  it('passes through non-negative integers', () => {
    expect(sanitizeScore(0)).toBe(0);
    expect(sanitizeScore(12345)).toBe(12345);
  });

  it('floors fractional scores', () => {
    expect(sanitizeScore(99.9)).toBe(99);
  });

  it('coerces numeric strings', () => {
    expect(sanitizeScore('4200')).toBe(4200);
  });

  it('clamps invalid / negative / non-numeric input to 0', () => {
    expect(sanitizeScore(-5)).toBe(0);
    expect(sanitizeScore(NaN)).toBe(0);
    expect(sanitizeScore(Infinity)).toBe(0);
    expect(sanitizeScore('nope')).toBe(0);
    expect(sanitizeScore(null)).toBe(0);
    expect(sanitizeScore(undefined)).toBe(0);
    expect(sanitizeScore({})).toBe(0);
  });
});

describe('high-score store', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tr-store-'));
    file = join(dir, 'highscore.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns 0 when the file does not exist', () => {
    expect(readHighScore(file)).toBe(0);
  });

  it('returns 0 for corrupt JSON', () => {
    writeFileSync(file, '{not valid json', 'utf8');
    expect(readHighScore(file)).toBe(0);
  });

  it('round-trips a written score', () => {
    writeHighScore(file, 5000);
    expect(readHighScore(file)).toBe(5000);
  });

  it('creates the parent directory if missing', () => {
    const nested = join(dir, 'a', 'b', 'highscore.json');
    writeHighScore(nested, 700);
    expect(readHighScore(nested)).toBe(700);
  });

  it('keeps the maximum and never regresses', () => {
    expect(writeHighScore(file, 8000)).toBe(8000);
    expect(writeHighScore(file, 3000)).toBe(8000); // lower ignored
    expect(readHighScore(file)).toBe(8000);
    expect(writeHighScore(file, 9000)).toBe(9000); // higher wins
    expect(readHighScore(file)).toBe(9000);
  });

  it('sanitizes before persisting', () => {
    writeHighScore(file, 123.99);
    expect(readHighScore(file)).toBe(123);
  });

  it('does not leave a temp file behind after an atomic write', () => {
    writeHighScore(file, 4242);
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });

  it('persists valid JSON with the documented shape', () => {
    writeHighScore(file, 111);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ highScore: 111 });
  });
});
