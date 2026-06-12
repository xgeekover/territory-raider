/** Logical playfield size in cells (outermost 1-cell ring is BORDER). */
export const GRID_WIDTH = 128;
export const GRID_HEIGHT = 96;

/** Integer canvas scale: 1 cell = CELL_PX pixels (128x96 -> 768x576). */
export const CELL_PX = 6;

/** Fixed-timestep simulation rate. */
export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;
/**
 * Upper clamp for a single rAF frame delta, so returning from a hidden tab
 * cannot flood the accumulator and tunnel entities through walls.
 */
export const MAX_FRAME_DT = 0.1;

/** Player movement speed in cells/sec. */
export const PLAYER_SPEED = 28;
/** Item 'S' multiplier, lasts for the rest of the stage. */
export const SPEED_BOOST_MULT = 1.5;
/** Post-respawn invincibility (blinking) in seconds. */
export const RESPAWN_INVINCIBILITY = 2;
export const START_LIVES = 3;

/** Stage clears when claimed ratio (interior cells) reaches this. */
export const CLEAR_RATIO = 0.8;
/** A single closure claiming at least this fraction of the interior doubles its score. */
export const BIG_CLAIM_RATIO = 0.15;
export const CELL_SCORE = 10;
export const BIG_CLAIM_MULTIPLIER = 2;
/** Bonus per minion destroyed by being enclosed in a claim. */
export const TRAP_BONUS = 1000;
/** Bonus for clearing a stage by killing the boss with the laser. */
export const BOSS_KILL_BONUS = 50000;
/** Bonus per percentage point of claim beyond the 80% target. */
export const OVERCLEAR_BONUS_PER_PERCENT = 1000;

/** Item effect tuning (spec 2.6). */
export const ITEM_POINTS = 5000;
export const TIME_STOP_DURATION = 10;
export const LASER_CHARGES = 5;
export const LASER_SPEED = 90; // cells/sec
/** Items per stage are placed at least this far from the border ring. */
export const ITEM_PLACEMENT_MARGIN = 10;
export const ITEM_MIN_SEPARATION = 14;

/** Enemy tuning not covered by per-stage config. */
export const WANDERER_SPEED = 10; // cells/sec
export const EDGE_CRAWLER_SPEED = 14; // boundary cells/sec
/** Per-enemy cooldown between spark spawns from trail contact. */
export const SPARK_SPAWN_COOLDOWN = 1.5;
/** Boss velocity perturbation on each bounce, in degrees (+/-). */
export const BOUNCE_JITTER_DEG = 15;

/** Contact distances (cell units, center-to-center) for player death while drawing. */
export const BOSS_CONTACT_DIST = 2.0;
export const WANDERER_CONTACT_DIST = 1.2;
export const CRAWLER_CONTACT_DIST = 1.2;
/** Laser hit distances. */
export const LASER_HIT_BOSS_DIST = 2.0;
export const LASER_HIT_MINION_DIST = 1.2;

/** Visual sizes (cell units) used by the renderer only. */
export const BOSS_RADIUS = 2.2;
export const WANDERER_RADIUS = 0.9;

export const HIGHSCORE_KEY = 'territory-raider-highscore';
