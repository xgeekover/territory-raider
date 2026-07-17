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

/**
 * Per-stage (per-life) countdown. Running it out costs a life; the clock is
 * refilled on every stage entry and on every respawn. As it drains, enemies
 * speed up to pile on pressure: below WARN they move a bit faster, below DANGER
 * faster still (dt for every enemy system is multiplied by the matching scale).
 */
export const STAGE_TIME_LIMIT = 60; // seconds per life on a stage
export const STAGE_TIME_WARN = 20; // enemies speed up at/below this many seconds left
export const STAGE_TIME_DANGER = 10; // enemies speed up more at/below this
export const ENEMY_SPEED_SCALE_WARN = 1.25;
export const ENEMY_SPEED_SCALE_DANGER = 1.5;

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

/**
 * Elemental hazards (themed stages, spec: themes rotate every 10 stages).
 * A drawing player entering a hazard cell takes the theme effect, then gets a
 * short grace so one patch can't chain-trigger every subsequent cell.
 */
export const HAZARD_SLOW_FACTOR = 0.5; // ice: movement speed multiplier
export const HAZARD_SLOW_DURATION = 3; // seconds
export const HAZARD_STUN_DURATION = 1; // lightning: frozen solid, seconds
export const HAZARD_GRACE = 1.5; // seconds of immunity after any trigger
/**
 * Lightning chain: the bolt that stuns the player also arcs to nearby
 * minions and freezes them — a deliberate risk/reward: tap a storm patch to
 * stop your pursuers at the cost of a shorter self-stun.
 */
export const LIGHTNING_CHAIN_RADIUS = 16; // cells, from the trigger cell
export const LIGHTNING_CHAIN_FREEZE = 2.5; // seconds minions stay frozen
export const LIGHTNING_ARC_TTL = 0.45; // seconds an arc stays visible
/** Obstacle/hazard placement: keep clear of the border ring and boss spawn. */
export const FIELD_FEATURE_MARGIN = 5; // min distance from the border ring
export const FIELD_FEATURE_CENTER_CLEARANCE = 14; // radius kept free around center

/** Enemy tuning not covered by per-stage config. */
export const WANDERER_SPEED = 10; // cells/sec
export const EDGE_CRAWLER_SPEED = 14; // boundary cells/sec
/** Per-enemy cooldown between spark spawns from trail contact. */
export const SPARK_SPAWN_COOLDOWN = 1.5;
/** Boss velocity perturbation on each bounce, in degrees (+/-). */
export const BOUNCE_JITTER_DEG = 15;

/**
 * Boss battle (spec: "the Core fights back"). The boss fires aimed projectiles
 * on a cooldown; claiming territory enrages it — rage 1 fires faster, rage 2
 * adds a 3-shot fan. Projectiles live only in unclaimed space (they splash on
 * claimed/border cells) and, like every enemy, only kill a DRAWING player.
 */
export const BOSS_FIRE_COOLDOWN = 2.8; // seconds between volleys (rage 0, default)
export const BOSS_RAGE1_RATIO = 0.4; // claimed ratio that triggers rage 1
export const BOSS_RAGE2_RATIO = 0.65; // claimed ratio that triggers rage 2
export const BOSS_RAGE_COOLDOWN_MULT = [1, 0.62, 0.42] as const; // per rage level
export const PROJECTILE_SPEED = 15; // cells/sec (default; stages may override)
export const PROJECTILE_CONTACT_DIST = 1.0; // kill radius vs a drawing player
export const PROJECTILE_FAN_RAD = 0.42; // rage-2 fan spread (radians from center)

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
