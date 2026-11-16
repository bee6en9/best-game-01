// The shard-ship: movement with acceleration and damping, the dash, firing, and taking hits.
// The player object lives on the game state; these functions are the only ones that change it.

import { FIELD, PLAYER } from './config.js';

/** A fresh player in the middle of the arena, at full hull. */
export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    maxHull: PLAYER.hull,
    lives: PLAYER.lives,
    shield: 0,
    damageLevel: 0,
    speedLevel: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invulnerable: 0,
    thrust: 0,
  };
}

/** Bullet damage after the damage upgrades. */
export function bulletDamage(player) {
  return PLAYER.bulletDamage * (1 + 0.25 * player.damageLevel);
}

/** Top speed after the speed upgrades. */
export function topSpeed(player) {
  return PLAYER.speed * (1 + 0.12 * player.speedLevel);
}

/**
 * One step of the ship. `aim` is the field point the ship faces; `move` the normalised WASD
 * vector; `firing` whether the trigger is held; `wantDash` whether Shift is held. Bullets are
 * pushed into `state.bullets`; `audio` is called for the shot and the dash.
 */
export function updatePlayer(state, input, aim, dt) {
  const player = state.player;
  const speed = topSpeed(player);

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.dashX * PLAYER.dashSpeed;
    player.vy = player.dashY * PLAYER.dashSpeed;
  } else {
    const move = input.moveVector();
    player.vx += move.x * PLAYER.acceleration * dt;
    player.vy += move.y * PLAYER.acceleration * dt;
    const velocity = Math.hypot(player.vx, player.vy);
    if (velocity > speed) {
      player.vx = (player.vx / velocity) * speed;
      player.vy = (player.vy / velocity) * speed;
    }
    // Drag when no key is held, so the ship glides to a stop instead of sliding forever.
    if (move.x === 0 && move.y === 0) {
      const drag = Math.max(0, 1 - 6 * dt);
      player.vx *= drag;
      player.vy *= drag;
    }
    player.thrust = Math.min(1, velocity / speed);
    if (input.dashHeld && player.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.dashX = move.x;
      player.dashY = move.y;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.05);
      state.audio.dash();
      spawnDashParticles(state);
    }
  }
  if (player.dashCooldown > 0) player.dashCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;

  player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
  player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
  player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);

  player.fireTimer -= dt;
  if (input.firingKeyboard && player.fireTimer <= 0) {
    player.fireTimer = 1 / PLAYER.fireRate;
    const spread = (state.random() - 0.5) * 0.08;
    const angle = player.angle + spread;
    state.bullets.push({
      x: player.x + Math.cos(player.angle) * (player.radius + 6),
      y: player.y + Math.sin(player.angle) * (player.radius + 6),
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
      damage: bulletDamage(player),
      life: 1.1,
    });
    state.audio.shoot();
  }
}

function spawnDashParticles(state) {
  const player = state.player;
  for (let index = 0; index < 10; index += 1) {
    state.particles.push({
      x: player.x - player.dashX * player.radius,
      y: player.y - player.dashY * player.radius,
      vx: -player.dashX * 120 + (state.random() - 0.5) * 120,
      vy: -player.dashY * 120 + (state.random() - 0.5) * 120,
      life: 0.3,
      maxLife: 0.3,
      size: 3,
      color: '#35e0ff',
    });
  }
}

/**
 * The ship takes `amount` damage. A shield cell absorbs the whole hit first. Returns 'dead'
 * when a life is lost, 'over' when the last life is gone, or 'hit' otherwise.
 */
export function hurtPlayer(state, amount) {
  const player = state.player;
  if (player.invulnerable > 0 || state.screen !== 'play') return 'none';
  if (player.shield > 0) {
    player.shield -= 1;
    player.invulnerable = PLAYER.invulnerableAfterHit;
    state.audio.hit();
    return 'shield';
  }
  player.hull -= amount;
  player.invulnerable = PLAYER.invulnerableAfterHit;
  state.audio.hurt();
  if (player.hull > 0) return 'hit';
  player.lives -= 1;
  burst(state, player.x, player.y, '#ff4d6d', 26);
  if (player.lives <= 0) {
    player.hull = 0;
    return 'over';
  }
  player.hull = player.maxHull;
  player.x = FIELD.width / 2;
  player.y = FIELD.height / 2;
  player.vx = 0;
  player.vy = 0;
  player.invulnerable = PLAYER.invulnerableAfterDeath;
  return 'dead';
}

/** A burst of sparks at a point, for hits and deaths. */
export function burst(state, x, y, color, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = state.random() * Math.PI * 2;
    const speed = 60 + state.random() * 240;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + state.random() * 0.3,
      maxLife: 0.65,
      size: 2 + state.random() * 3,
      color,
    });
  }
  if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
}
