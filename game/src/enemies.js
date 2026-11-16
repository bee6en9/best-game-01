// The enemies: Drifters chase, Spinners orbit and shoot, Splitters break into Minis, and the
// shard-golem boss fires radial bursts and aimed spreads. No drawing here, only behaviour;
// render.js paints what these functions move.

import { ENEMY, FIELD } from './config.js';
import { range } from './random.js';
import { burst } from './player.js';

/** A fresh enemy of `kind` at the arena edge nearest the given angle. */
export function createEnemy(kind, wave, random) {
  const tune = ENEMY[kind];
  const angle = random() * Math.PI * 2;
  const margin = 40;
  const x = FIELD.width / 2 + Math.cos(angle) * (FIELD.width / 2 + margin);
  const y = FIELD.height / 2 + Math.sin(angle) * (FIELD.height / 2 + margin);
  return {
    kind,
    x: Math.min(FIELD.width - 20, Math.max(20, x)),
    y: Math.min(FIELD.height - 20, Math.max(20, y)),
    vx: 0,
    vy: 0,
    radius: tune.radius,
    hp: tune.hp + (kind === 'boss' ? 0 : wave * 4),
    maxHp: tune.hp + (kind === 'boss' ? 0 : wave * 4),
    speed: tune.speed + tune.speedPerWave * (wave - 1),
    angle: random() * Math.PI * 2,
    spin: range(random, -1.6, 1.6),
    shootTimer: range(random, 1, 2),
    radialTimer: 1.6,
    spreadTimer: 1.0,
    orbitDirection: random() < 0.5 ? -1 : 1,
    flash: 0,
  };
}

/** The boss of a boss wave, dropped in the middle of the top edge. */
export function createBoss(wave) {
  const tune = ENEMY.boss;
  const hp = wave >= 10 ? tune.hp : tune.hpWave5;
  return {
    kind: 'boss',
    x: FIELD.width / 2,
    y: 110,
    vx: 0,
    vy: 0,
    radius: tune.radius,
    hp,
    maxHp: hp,
    speed: tune.speed,
    angle: 0,
    spin: 0.4,
    shootTimer: 1,
    radialTimer: 2.0,
    spreadTimer: 1.2,
    orbitDirection: 1,
    flash: 0,
    final: wave >= 10,
  };
}

function distanceToPlayer(state, enemy) {
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  return { dx, dy, distance: Math.hypot(dx, dy) || 1 };
}

function fireEnemyBullet(state, enemy, angle, speed) {
  state.enemyBullets.push({
    x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
    y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 6,
    damage: 10,
    life: 5,
  });
}

/** Steer one enemy for a step; shooters fire, the boss runs its two patterns. */
export function updateEnemy(state, enemy, dt) {
  const tune = ENEMY[enemy.kind];
  const player = state.player;
  const { dx, dy, distance } = distanceToPlayer(state, enemy);
  const toward = { x: dx / distance, y: dy / distance };

  if (enemy.kind === 'drifter' || enemy.kind === 'mini') {
    enemy.vx = toward.x * enemy.speed;
    enemy.vy = toward.y * enemy.speed;
  } else if (enemy.kind === 'splitter') {
    enemy.vx = toward.x * enemy.speed;
    enemy.vy = toward.y * enemy.speed;
    enemy.angle += enemy.spin * dt;
  } else if (enemy.kind === 'spinner') {
    // Hold a ring around the player and drift along it, firing aimed shots.
    const orbit = ENEMY.spinner.orbit;
    const radial = distance > orbit + 30 ? 1 : distance < orbit - 30 ? -1 : 0;
    const tangent = { x: -toward.y * enemy.orbitDirection, y: toward.x * enemy.orbitDirection };
    enemy.vx = (toward.x * radial * 0.7 + tangent.x) * enemy.speed;
    enemy.vy = (toward.y * radial * 0.7 + tangent.y) * enemy.speed;
    enemy.angle += enemy.spin * dt;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && distance < 620) {
      enemy.shootTimer = ENEMY.spinner.shootEvery;
      fireEnemyBullet(state, enemy, Math.atan2(dy, dx), ENEMY.spinner.bulletSpeed);
      state.audio.enemyShoot();
    }
  } else if (enemy.kind === 'boss') {
    enemy.vx = toward.x * enemy.speed * 0.6;
    enemy.vy = toward.y * enemy.speed * 0.6 + Math.sin(state.elapsed * 0.9) * 24;
    enemy.angle += enemy.spin * dt;
    enemy.radialTimer -= dt;
    if (enemy.radialTimer <= 0) {
      enemy.radialTimer = ENEMY.boss.radialEvery;
      for (let index = 0; index < ENEMY.boss.radialCount; index += 1) {
        const angle = (index / ENEMY.boss.radialCount) * Math.PI * 2 + enemy.angle;
        fireEnemyBullet(state, enemy, angle, ENEMY.boss.bulletSpeed);
      }
      state.audio.enemyShoot();
    }
    enemy.spreadTimer -= dt;
    if (enemy.spreadTimer <= 0) {
      enemy.spreadTimer = ENEMY.boss.spreadEvery;
      const base = Math.atan2(dy, dx);
      for (const offset of [-0.22, 0, 0.22]) fireEnemyBullet(state, enemy, base + offset, ENEMY.boss.bulletSpeed + 40);
      state.audio.enemyShoot();
    }
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.x = Math.min(FIELD.width - enemy.radius, Math.max(enemy.radius, enemy.x));
  enemy.y = Math.min(FIELD.height - enemy.radius, Math.max(enemy.radius, enemy.y));
  if (enemy.flash > 0) enemy.flash -= dt;
}

/**
 * Damage an enemy. Returns true when it dies: the caller then pays out score and shards and
 * removes it. Splitters leave two Minis behind in `state.enemies`.
 */
export function damageEnemy(state, enemy, damage) {
  enemy.hp -= damage;
  enemy.flash = 0.09;
  if (enemy.hp > 0) return false;
  enemy.dead = true;
  burst(state, enemy.x, enemy.y, enemy.kind === 'boss' ? '#b18cff' : '#ff7a1a', enemy.kind === 'boss' ? 40 : 14);
  if (enemy.kind === 'splitter') {
    for (let index = 0; index < 2; index += 1) {
      const mini = createEnemy('mini', state.wave, state.random);
      mini.x = enemy.x + (index === 0 ? -18 : 18);
      mini.y = enemy.y + (index === 0 ? -12 : 12);
      state.enemies.push(mini);
    }
  }
  dropShards(state, enemy);
  return true;
}

function dropShards(state, enemy) {
  const tune = ENEMY[enemy.kind];
  const count = tune.shards;
  for (let index = 0; index < count; index += 1) {
    const angle = state.random() * Math.PI * 2;
    state.pickups.push({
      x: enemy.x + Math.cos(angle) * 14,
      y: enemy.y + Math.sin(angle) * 14,
      vx: Math.cos(angle) * 70,
      vy: Math.sin(angle) * 70,
      value: 1,
      kind: 'shard',
    });
  }
}
