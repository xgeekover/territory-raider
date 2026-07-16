import { useMemo } from 'react';

const PALETTE = ['#22d3ee', '#e879f9', '#fde047', '#6ee7b7', '#f0abfc', '#67e8f9'];

/**
 * Lightweight CSS confetti for celebration overlays (stage clear, victory,
 * new high score). Pieces are randomized once per mount — pure presentation,
 * no game state involved.
 */
export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        left: `${Math.random() * 100}%`,
        size: 4 + Math.random() * 6,
        color: PALETTE[i % PALETTE.length]!,
        delay: `${Math.random() * 1.4}s`,
        duration: `${2.2 + Math.random() * 2}s`,
        rotate: Math.random() > 0.5 ? '2px' : '10px', // mix of squares and slivers
      })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.key}
          className="confetti-piece"
          style={{
            left: p.left,
            width: p.size,
            height: p.rotate === '2px' ? p.size : p.size * 0.4,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
