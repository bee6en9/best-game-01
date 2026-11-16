// Every tuning number and colour for STARSHARD ARENA in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on the
// screen size. All movement speeds are in logical pixels per second.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 250,
  acceleration: 2400,
  hull: 100,
  lives: 3,
  maxLives: 5,
  fireRate: 7,
  bulletSpeed: 640,
  bulletDamage: 10,
  bulletRadius: 4,
  dashSpeed: 820,
  dashTime: 0.16,
  dashCooldown: 1.4,
  invulnerableAfterHit: 0.9,
  invulnerableAfterDeath: 2.0,
  pickupRadius: 24,
  magnetRadius: 150,
};

export const ENEMY = {
  drifter: { radius: 16, hp: 30, speed: 95, speedPerWave: 6, contact: 10, score: 50, shards: 2 },
  spinner: { radius: 15, hp: 40, speed: 70, speedPerWave: 4, contact: 10, score: 80, shards: 3, shootEvery: 1.8, bulletSpeed: 230, orbit: 270 },
  splitter: { radius: 21, hp: 60, speed: 58, speedPerWave: 3, contact: 12, score: 100, shards: 3 },
  mini: { radius: 10, hp: 10, speed: 175, speedPerWave: 5, contact: 6, score: 25, shards: 1 },
  boss: { radius: 62, hp: 650, hpWave5: 260, speed: 46, contact: 25, score: 2000, shards: 30, radialEvery: 2.4, radialCount: 12, spreadEvery: 1.5, bulletSpeed: 200 },
};

export const WAVE = {
  spawnInterval: 0.8,
  minSpawnInterval: 0.42,
  bossEvery: 5,
  finalWave: 10,
  clearHeal: 15,
};

export const COMBO = { window: 3.0, perKill: 0.1, max: 3.0 };

export const SHARD = { driftSpeed: 60, valueJitter: 0 };

export const PALETTE = {
  backdrop: '#070a18',
  field: '#0b0f24',
  grid: '#141a38',
  panel: '#131a38',
  panelEdge: '#2a3468',
  text: '#eef1ff',
  muted: '#8b93b8',
  ember: '#ff7a1a',
  emberLight: '#ffb347',
  cyan: '#35e0ff',
  violet: '#b18cff',
  hull: '#39d98a',
  danger: '#ff4d6d',
  shard: '#ffd94d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'starshard-arena.best';
