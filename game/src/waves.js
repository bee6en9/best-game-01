// Wave building and spawning. A wave is a queue of enemies released one at a time from the
// arena edges; every fifth wave is a boss wave. When the queue is empty and nothing hostile
// remains, the wave is clear: the shop opens, or the game is won on wave 10.

import { ENEMY, WAVE } from './config.js';
import { createBoss, createEnemy } from './enemies.js';
import { pick } from './random.js';

/** The spawn list for wave `n`: kinds in the order they appear, shuffled by the seeded RNG. */
export function buildWave(wave, random) {
  const queue = [];
  const drifters = 2 + wave;
  const spinners = wave >= 2 ? 1 + Math.floor((wave - 1) / 2) : 0;
  const splitters = wave >= 3 ? Math.floor((wave - 1) / 2) : 0;
  for (let index = 0; index < drifters; index += 1) queue.push('drifter');
  for (let index = 0; index < spinners; index += 1) queue.push('spinner');
  for (let index = 0; index < splitters; index += 1) queue.push('splitter');
  // Fisher-Yates with the seeded RNG, so the same seed always deals the same wave.
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = queue[index];
    queue[index] = queue[other];
    queue[other] = held;
  }
  return queue;
}

function isBossWave(wave) {
  return wave % WAVE.bossEvery === 0;
}

/** Start wave `n` on the state: reset the queue, the timers and the boss flag. */
export function startWave(state, wave) {
  state.wave = wave;
  state.spawnQueue = buildWave(wave, state.random);
  state.spawnTimer = 0.6;
  state.spawnInterval = Math.max(WAVE.minSpawnInterval, WAVE.spawnInterval - wave * 0.04);
  state.waveActive = true;
  state.bossSpawned = false;
  state.boss = null;
  if (isBossWave(wave)) {
    state.boss = createBoss(wave);
    state.enemies.push(state.boss);
    state.bossSpawned = true;
    state.audio.boss();
  }
}

/**
 * Release queued enemies on the timer. Returns 'clear' when the wave is finished, 'boss' while
 * a boss wave's golem still lives, or 'fighting' while anything remains.
 */
export function updateWaves(state, dt) {
  if (!state.waveActive) return 'idle';
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = state.spawnInterval;
      const kind = state.spawnQueue.shift();
      state.enemies.push(createEnemy(kind, state.wave, state.random));
    }
  }
  const hostileLeft = state.enemies.length > 0 || state.spawnQueue.length > 0;
  if (hostileLeft) return state.boss !== null ? 'boss' : 'fighting';
  state.waveActive = false;
  return 'clear';
}

/** Heal a little on every cleared wave; the shop opens right after. */
export function onWaveClear(state) {
  const player = state.player;
  player.hull = Math.min(player.maxHull, player.hull + WAVE.clearHeal);
  state.audio.waveClear();
}
