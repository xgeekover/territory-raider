import { isBossStage, BOSS_STAGE_INTERVAL, themeOf } from '../../engine/config/stages';
import type { ThemeKind } from '../../engine/core/types';

// Themed blocks announce their element so the hazard patches read instantly.
const THEME_TAG: Record<ThemeKind, { label: string; className: string }> = {
  fire: { label: '🔥 FIRE ZONE — FLAMES BURN YOUR CUT', className: 'text-orange-400' },
  ice: { label: '❄ ICE ZONE — FROST SLOWS YOU', className: 'text-sky-300' },
  lightning: { label: '⚡ STORM ZONE — BOLTS STUN YOU', className: 'text-yellow-300' },
};

// Codename pools cycled by stage — pure flavor, and endless like the campaign.
const REGULAR_NAMES = [
  'FIRST LIGHT', 'VIOLET DUSK', 'EMERALD GRID', 'CRIMSON SECTOR',
  'ACID FIELDS', 'DEEP CURRENT', 'RUST QUADRANT', 'FROZEN VECTOR',
  'NEON WASTES', 'SHATTERED GRID', 'COBALT REACH', 'EMBER DELTA',
  'VOID MARGIN', 'PHANTOM SECTOR', 'COBALT ABYSS', 'EVENT HORIZON',
  'SILENT EXPANSE', 'GLASS HORIZON', 'IRON TIDE', 'SPECTRAL RIFT',
  'DYING STARLIGHT', 'OBSIDIAN REACH', 'CRIMSON THRESHOLD', 'THE LONG DARK',
] as const;
const BOSS_NAMES = [
  'THE CORE STIRS', 'THE CORE HUNTS', 'THE CORE RAGES', 'THE CORE UNBOUND',
  'THE CORE ASCENDANT', 'THE CORE ETERNAL', 'THE CORE REBORN', 'THE CORE INFINITE',
] as const;

function stageName(stage: number): string {
  if (isBossStage(stage)) {
    return BOSS_NAMES[(Math.floor((stage - 1) / BOSS_STAGE_INTERVAL)) % BOSS_NAMES.length]!;
  }
  return REGULAR_NAMES[(stage - 1) % REGULAR_NAMES.length]!;
}

/**
 * Slides in for ~1.8s when a stage begins, then fades itself out (pure CSS —
 * the parent unmounts it on `onAnimationEnd`). Boss stages announce themselves
 * in alarm red with a "CORE ASSAULT" tag.
 */
export function StageBanner({ stage, onDone }: { stage: number; onDone: () => void }) {
  const name = stageName(stage);
  const boss = isBossStage(stage);
  const theme = themeOf(stage - 1);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="stage-banner flex flex-col items-center gap-1" onAnimationEnd={onDone}>
        {boss && (
          <p className="animate-pulse text-sm font-bold tracking-[0.5em] text-rose-400 drop-shadow-[0_0_16px_rgba(251,113,133,0.9)]">
            ⚠ CORE ASSAULT ⚠
          </p>
        )}
        <p
          className={`text-3xl font-bold tracking-[0.4em] drop-shadow-[0_0_20px_rgba(34,211,238,0.8)] ${
            boss ? 'text-rose-300' : 'text-cyan-300'
          }`}
        >
          STAGE {stage}
        </p>
        <p className={`text-sm tracking-[0.5em] ${boss ? 'text-rose-300' : 'text-fuchsia-300'}`}>
          {name}
        </p>
        {theme && (
          <p className={`text-[11px] tracking-[0.3em] ${THEME_TAG[theme].className}`}>
            {THEME_TAG[theme].label}
          </p>
        )}
        <p className="mt-1 text-[10px] tracking-widest text-zinc-500">
          {boss ? 'THE CORE FIGHTS BACK — CLAIM 80%' : 'CLAIM 80% OF THE FIELD'}
        </p>
      </div>
    </div>
  );
}
