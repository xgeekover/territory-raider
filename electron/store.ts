/**
 * High-score persistence for the desktop build.
 *
 * Pure Node (fs/path) — no Electron imports — so it is unit-testable under
 * Vitest and reusable by the main process. Writes are atomic (temp file +
 * rename) so a crash mid-write can never corrupt the store.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

interface StoreShape {
  highScore: number;
}

/** Coerce arbitrary input to a safe, non-negative integer score. */
export function sanitizeScore(input: unknown): number {
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Read the persisted high score; returns 0 on any missing/corrupt state. */
export function readHighScore(file: string): number {
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return sanitizeScore(parsed.highScore);
  } catch {
    // Missing file, bad JSON, permission error — treat as no score yet.
    return 0;
  }
}

/**
 * Persist a high score atomically. Only writes when the new value beats the
 * stored one, so concurrent callers never regress the record.
 * Returns the effective (max) score now on disk.
 */
export function writeHighScore(file: string, score: number): number {
  const next = sanitizeScore(score);
  const current = readHighScore(file);
  if (next <= current) return current;

  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const payload: StoreShape = { highScore: next };
  writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  renameSync(tmp, file);
  return next;
}
