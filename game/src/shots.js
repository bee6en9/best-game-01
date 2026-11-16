// The screenshot scenes behind ?shot=start|play|victory|gameover (with &seed=N). Each one
// plays the real rules forward from a fresh run for a fixed number of steps, steered by a simple
// autopilot (chase the nearest enemy, strafe at range, flee when crowded, collect shards when
// the coast is clear), so the frame is what a short game really looks like and the same seed
// always gives the same frame. The victory scene stages the wave-10 golem at low hull and lets
// the autopilot finish it; the game-over scene steers a careless pilot that never shoots.

import { FIELD, STEP } from './config.js';
import { createBoss, createEnemy, damageEnemy } from './enemies.js';
import { hurtPlayer } from './player.js';

const PLAY_SECONDS = 30;
const PLAY_MIN_SECONDS = 15;
const PLAY_MIN_ENEMIES = 5;
const VICTORY_LIMIT_SECONDS = 75;
const END_LIMIT_SECONDS = 150;

/** The autopilot: returns the drive {move, aim, firing, dash} for one step. */
function makeAutopilot(state) {
  let strafeDirection = 1;
  let strafeTimer = 0;
  return function drive(dt) {
    strafeTimer -= dt;
    if (strafeTimer <= 0) {
      strafeTimer = 1.5 + state.random() * 1.5;
      strafeDirection *= -1;
    }
    const player = state.player;
    let target = null;
    let targetDistance = Infinity;
    for (const enemy of state.enemies) {
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (distance < targetDistance) {
        targetDistance = distance;
        target = enemy;
      }
    }
    let shard = null;
    let shardDistance = Infinity;
    for (const pickup of state.pickups) {
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      if (distance < shardDistance) {
        shardDistance = distance;
        shard = pickup;
      }
    }
    let moveX = 0;
    let moveY = 0;
    if (target !== null) {
      const dx = (target.x - player.x) / targetDistance;
      const dy = (target.y - player.y) / targetDistance;
      if (targetDistance < 120) {
        moveX = -dx;
        moveY = -dy;
      } else if (targetDistance > 320) {
        moveX = dx;
        moveY = dy;
      } else {
        moveX = -dy * strafeDirection;
        moveY = dx * strafeDirection;
      }
    }
    if (shard !== null && (target === null || targetDistance > 200) && shardDistance < 260) {
      const dx = (shard.x - player.x) / shardDistance;
      const dy = (shard.y - player.y) / shardDistance;
      moveX = moveX * 0.4 + dx * 0.6;
      moveY = moveY * 0.4 + dy * 0.6;
    }
    const length = Math.hypot(moveX, moveY);
    if (length > 0.01) {
      moveX /= length;
      moveY /= length;
    }
    const aim = target === null
      ? { x: player.x, y: player.y - 100 }
      : { x: target.x + target.vx * 0.25, y: target.y + target.vy * 0.25 };
    return {
      move: { x: moveX, y: moveY },
      aim,
      firing: target !== null && targetDistance < 580,
      dash: target !== null && targetDistance < 95 && player.dashCooldown <= 0,
    };
  };
}

/** The careless pilot: walks straight at the nearest enemy, never shoots, never dashes. */
function carelessDrive(state) {
  const player = state.player;
  let target = null;
  let targetDistance = Infinity;
  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < targetDistance) {
      targetDistance = distance;
      target = enemy;
    }
  }
  if (target === null) return { move: { x: 0, y: 0 }, aim: { x: player.x, y: player.y - 100 }, firing: false, dash: false };
  return {
    move: { x: (target.x - player.x) / targetDistance, y: (target.y - player.y) / targetDistance },
    aim: { x: target.x, y: target.y },
    firing: false,
    dash: false,
  };
}

/**
 * Set the game to the named scene and return the screen to draw over it and the best score to
 * show. 'start' is the title over a drifting backdrop; 'play' is mid-fight; 'victory' is the
 * wave-10 golem shattered; 'end' and 'gameover' are the game-over screen.
 */
export function stageShot(name, sim) {
  const state = sim.state;

  if (name === 'play') {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      sim.resetRun();
      sim.startRun();
      if (attempt === 1) {
        state.player.damageLevel = 2;
        state.player.hull = state.player.maxHull;
      }
      const drive = makeAutopilot(state);
      for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
        sim.step(drive(STEP), STEP);
        if (state.screen === 'shop') sim.continueFromShop();
        if (state.screen === 'over' || state.screen === 'victory') break;
        // Stop on a busy frame: at least fifteen seconds in, five or more hostiles on screen.
        if (index > PLAY_MIN_SECONDS / STEP && state.enemies.length >= PLAY_MIN_ENEMIES) break;
      }
      if (state.screen === 'play') return { screen: 'play', best: state.score };
    }
    return { screen: state.screen, best: state.score };
  }

  if (name === 'victory') {
    sim.resetRun();
    sim.startRun();
    state.enemies.length = 0;
    state.spawnQueue = [];
    state.wave = 10;
    state.waveActive = true;
    const boss = createBoss(10);
    boss.hp = Math.floor(boss.maxHp * 0.25);
    state.boss = boss;
    state.enemies.push(boss);
    state.player.damageLevel = 3;
    state.player.hull = state.player.maxHull;
    state.score = 2450;
    state.shards = 12;
    const drive = makeAutopilot(state);
    for (let index = 0; index < VICTORY_LIMIT_SECONDS / STEP; index += 1) {
      sim.step(drive(STEP), STEP);
      if (state.screen === 'victory') break;
      if (state.screen === 'over' || state.screen === 'shop') break;
    }
    if (state.screen !== 'victory') {
      if (state.boss !== null) {
        damageEnemy(state, state.boss, 99999);
        state.enemies = state.enemies.filter((enemy) => !enemy.dead);
        state.boss = null;
      }
      state.waveActive = false;
      state.screen = 'victory';
    }
    return { screen: 'victory', best: Math.max(state.score, 2450) };
  }

  if (name === 'end' || name === 'gameover') {
    sim.resetRun();
    sim.startRun();
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      sim.step(carelessDrive(state), STEP);
      if (state.screen === 'shop') sim.continueFromShop();
      if (state.screen === 'over') break;
    }
    if (state.screen !== 'over') {
      state.player.lives = 1;
      state.player.hull = 1;
      state.player.invulnerable = 0;
      hurtPlayer(state, 999);
      state.screen = 'over';
    }
    return { screen: 'over', best: state.score };
  }

  // 'start' and anything else: the title over five seconds of drifting backdrop.
  sim.resetRun();
  const kinds = ['drifter', 'drifter', 'drifter', 'drifter', 'drifter', 'spinner', 'spinner'];
  for (const kind of kinds) {
    const enemy = createEnemy(kind, 1, state.random);
    enemy.x = 100 + state.random() * (FIELD.width - 200);
    enemy.y = 90 + state.random() * (FIELD.height - 200);
    state.enemies.push(enemy);
  }
  for (let index = 0; index < 5 / STEP; index += 1) sim.titleStep(STEP);
  return { screen: 'title', best: sim.best() };
}
