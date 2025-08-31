/** Suavizados base */
export const POS_LERP_BASE = 0.18;
export const MOUSE_LERP_BASE = 0.26;
export const MOUSE_LERP_FAST = 0.70;
export const SPEED_SMOOTH = 0.28;
export const DIST_DEAD = 6;

/** Control de rumbo */
export const RATE_MAX_BASE = 260;
export const RATE_MAX_FAST = 560;
export const ACCEL_MAX_BASE = 900;
export const ACCEL_MAX_FAST = 1900;
export const JERK_MAX_BASE = 9000;
export const JERK_MAX_FAST = 18000;
export const DEAD_RATE = 0.08;
export const DEAD_ERR = 0.25;
export const K_BASE = 26.0;
export const K_FAST = 46.0;

/** Aterrizaje (sin magnetismo) */
export const TARGET_SELECTOR = 'a, button, [role="button"], [data-magnet="true"]';
export const LAND_IDLE_SPEED_ENTER = 0.07;
export const LAND_IDLE_SPEED_EXIT = 0.11;
export const LAND_IDLE_TIME_ENTER = 240;
export const LAND_IDLE_TIME_EXIT = 120;
export const HIT_PAD = 10;

/** 3D (visual) */
export const BANK_MAX = 28;
export const BANK_FROM_RATE = 0.42;
export const PITCH_FROM_DY = 0.55;
export const LIFT_MAX = 1.05;
export const BANK_VISUAL_LERP = 0.14;
export const PITCH_VISUAL_LERP = 0.14;

/** Normalización del input speed */
export const INPUT_SPEED_FOR_FAST = 900;
export const INPUT_SPEED_FOR_BASE = 120;

/** Idle lock */
export const IDLE_LOCK_SPEED = 0.055;
export const IDLE_LOCK_DIST = 8;
export const IDLE_LOCK_AFTER_MS = 140;
export const IDLE_UNLOCK_BOOST = 1.0;

/** Láser */
export const LASER_COOLDOWN_MS = 120;
export const LASER_SPEED = 1600;
export const LASER_MAX_DIST = 700;
export const LASER_WIDTH = 2;
export const LASER_ORIGIN_TWEAK_X = 0.5;
export const LASER_ORIGIN_TWEAK_Y = 1;
export const NOSE_OFFSET = 25.0;
export const CANNON_OFFSET = 6.5;
export const LASER_START_FWD = 5;
export const LASER_FADE_TAIL = 0.25;
export const LASER_INHERIT_SHIP_VEL = 1.0;
export const LASER_SPAWN_LEAD = 0.016; // ~1 frame

/** Daño en letras */
export const DAMAGE_SELECTOR = '[data-damageable="true"]';
export const DAMAGE_ADD_PER_HIT = 0.18;

/** Partículas (chispas + fragmentos) */
export const SPARKS_PER_HIT: [number, number] = [10, 18];
export const FRAGS_PER_HIT: [number, number] = [3, 6];
export const SPARK_SPEED: [number, number] = [220, 520];
export const FRAG_SPEED: [number, number] = [90, 220];
export const SPARK_LIFE: [number, number] = [0.18, 0.36];
export const FRAG_LIFE: [number, number] = [0.45, 0.85];
export const GRAVITY = 450;
