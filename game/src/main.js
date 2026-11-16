// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, shop, paused, victory and game over.
//
// ?seed=N fixes the spawns. ?shot=start|play|victory|gameover (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, COMBO, ENEMY, FIELD, PLAYER, STEP, WAVE } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { burst, createPlayer, hurtPlayer, updatePlayer } from './player.js';
import { damageEnemy, updateEnemy } from './enemies.js';
import { onWaveClear, startWave, updateWaves } from './waves.js';
import { buyItem } from './shop.js';
import { createAudio } from './audio.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_VICTORY, createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function makeStars(random) {
  const stars = [];
  for (let index = 0; index < 110; index += 1) {
    stars.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      size: random() < 0.85 ? 1 : 2,
      twinkle: 0.6 + random() * 2.2,
      phase: random() * Math.PI * 2,
    });
  }
  return stars;
}

function createState() {
  const random = createRandom(seed);
  return {
    random,
    screen: SCREEN_TITLE,
    elapsed: 0,
    wave: 0,
    score: 0,
    shards: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    player: createPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    pickups: [],
    particles: [],
    stars: makeStars(random),
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 0.8,
    waveActive: false,
    boss: null,
    bossSpawned: false,
    aim: { x: FIELD.width / 2, y: FIELD.height / 2 - 100 },
    aimVisible: false,
    audio: createAudio(),
  };
}

const state = createState();
let best = readBest();

// Screen readers (and anyone watching the page's text) hear the screen changes.
function announce(message) {
  status.textContent = message;
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Wipe the run back to a fresh ship in an empty arena, on the title screen. */
function resetRun() {
  const keepStars = state.stars;
  const keepAudio = state.audio;
  const fresh = createState();
  fresh.stars = keepStars;
  fresh.audio = keepAudio;
  Object.assign(state, fresh);
  state.screen = SCREEN_TITLE;
}

/** Start wave 1 from a fresh run and open play. */
function startRun() {
  resetRun();
  startWave(state, 1);
  state.screen = SCREEN_PLAY;
  announce('Playing. Wave 1. Three lives.');
}

/** Launch the next wave out of the shop. */
function continueFromShop() {
  startWave(state, state.wave + 1);
  state.screen = SCREEN_PLAY;
  announce(`Wave ${state.wave}.`);
}

function endRun(won) {
  state.screen = won ? SCREEN_VICTORY : SCREEN_OVER;
  if (state.score > best) {
    best = state.score;
    saveBest(best);
  }
  if (won) state.audio.win();
  else state.audio.lose();
  announce(won ? `Victory. Final score ${state.score}.` : `Game over. Score ${state.score}. Best ${best}.`);
}

/** Pay out a kill: score with the combo multiplier, and a fresh combo window. */
function onEnemyKilled(enemy) {
  state.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO.window;
  state.multiplier = Math.min(COMBO.max, 1 + COMBO.perKill * state.combo);
  state.score += Math.round(ENEMY[enemy.kind].score * state.multiplier);
  state.audio.kill();
  if (enemy.kind === 'boss') state.boss = null;
}

/** One fixed step of the play simulation, driven by {move, aim, firing, dash}. */
function stepSimulation(drive, dt) {
  state.elapsed += dt;
  const adapter = {
    moveVector: () => drive.move,
    get firingKeyboard() {
      return drive.firing;
    },
    get dashHeld() {
      return drive.dash;
    },
  };
  updatePlayer(state, adapter, drive.aim, dt);
  state.aim = drive.aim;
  state.aimVisible = true;

  for (const enemy of state.enemies) updateEnemy(state, enemy, dt);

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  for (const bullet of state.bullets) {
    if (bullet.life <= 0) continue;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const reach = enemy.radius + bullet.radius;
      if (dx * dx + dy * dy < reach * reach) {
        bullet.life = 0;
        if (damageEnemy(state, enemy, bullet.damage)) onEnemyKilled(enemy);
        break;
      }
    }
  }
  state.bullets = state.bullets.filter(
    (bullet) => bullet.life > 0 && bullet.x > -40 && bullet.x < FIELD.width + 40 && bullet.y > -40 && bullet.y < FIELD.height + 40,
  );

  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    const dx = state.player.x - bullet.x;
    const dy = state.player.y - bullet.y;
    const reach = state.player.radius + bullet.radius - 2;
    if (dx * dx + dy * dy < reach * reach) {
      bullet.life = 0;
      if (hurtPlayer(state, bullet.damage) === 'over') {
        endRun(false);
        return;
      }
    }
  }
  state.enemyBullets = state.enemyBullets.filter(
    (bullet) => bullet.life > 0 && bullet.x > -40 && bullet.x < FIELD.width + 40 && bullet.y > -40 && bullet.y < FIELD.height + 40,
  );

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const reach = enemy.radius + state.player.radius - 2;
    if (dx * dx + dy * dy < reach * reach) {
      const result = hurtPlayer(state, ENEMY[enemy.kind].contact);
      if (result !== 'none') {
        if (damageEnemy(state, enemy, 25)) onEnemyKilled(enemy);
        if (result === 'over') {
          endRun(false);
          return;
        }
      }
    }
  }
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);

  for (const pickup of state.pickups) {
    const dx = state.player.x - pickup.x;
    const dy = state.player.y - pickup.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < PLAYER.magnetRadius) {
      pickup.vx += (dx / distance) * 900 * dt;
      pickup.vy += (dy / distance) * 900 * dt;
    } else {
      pickup.vx *= Math.max(0, 1 - 2 * dt);
      pickup.vy *= Math.max(0, 1 - 2 * dt);
    }
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    if (distance < PLAYER.pickupRadius) {
      pickup.taken = true;
      state.shards += pickup.value;
      state.audio.shard();
      burst(state, pickup.x, pickup.y, '#ffd94d', 4);
    }
  }
  state.pickups = state.pickups.filter((pickup) => !pickup.taken);

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.max(0, 1 - 2.5 * dt);
    particle.vy *= Math.max(0, 1 - 2.5 * dt);
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  state.comboTimer -= dt;
  if (state.comboTimer <= 0) {
    state.combo = 0;
    state.multiplier = 1;
  }

  if (updateWaves(state, dt) === 'clear') {
    if (state.wave >= WAVE.finalWave) {
      endRun(true);
      return;
    }
    onWaveClear(state);
    state.screen = SCREEN_SHOP;
    announce(`Wave ${state.wave} clear. Shop open.`);
  }
}

/** One fixed step of the title backdrop: the staged enemies drift and bounce. */
function titleStep(dt) {
  state.elapsed += dt;
  for (const enemy of state.enemies) {
    enemy.x += Math.cos(enemy.angle) * 26 * dt;
    enemy.y += Math.sin(enemy.angle) * 26 * dt;
    enemy.angle += enemy.spin * dt * 0.5;
    if (enemy.x < 30 || enemy.x > FIELD.width - 30) enemy.angle = Math.PI - enemy.angle;
    if (enemy.y < 30 || enemy.y > FIELD.height - 30) enemy.angle = -enemy.angle;
    enemy.x = Math.min(FIELD.width - 30, Math.max(30, enemy.x));
    enemy.y = Math.min(FIELD.height - 30, Math.max(30, enemy.y));
  }
}

// The simulation the screenshot stager drives: the same steps the loop runs, no browser in it.
const sim = {
  state,
  resetRun,
  startRun,
  step: stepSimulation,
  titleStep,
  continueFromShop,
  best: () => best,
};

function runShot(name) {
  const scene = stageShot(name, sim);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function handleActions(actions, shopChoice) {
    if (actions & ACTION_RESTART) {
      startRun();
      return;
    }
    if (state.screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        state.audio.unlock();
        startRun();
      }
    } else if (state.screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        state.screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (state.screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        state.screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (state.screen === SCREEN_SHOP) {
      if (shopChoice >= 0) {
        const result = buyItem(state, shopChoice);
        if (result === 'poor' || result === 'max') state.audio.denied();
        else if (result === 'bought') announce(`Bought. ${state.shards} shards left.`);
      }
      if (actions & ACTION_CONFIRM) continueFromShop();
    } else if (state.screen === SCREEN_VICTORY || state.screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startRun();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions(), input.takeShopChoice());
    if (state.screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        titleStep(STEP);
        accumulator -= STEP;
      }
    } else if (state.screen === SCREEN_PLAY) {
      const drive = {
        move: input.moveVector(),
        aim: input.mouse.inside ? renderer.screenToField(input.mouse.x, input.mouse.y) : { x: state.player.x, y: state.player.y - 100 },
        firing: input.firingKeyboard,
        dash: input.dashHeld,
      };
      while (accumulator >= STEP && state.screen === SCREEN_PLAY) {
        stepSimulation(drive, STEP);
        accumulator -= STEP;
      }
      if (state.screen !== SCREEN_PLAY) accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(state, state.screen, best);
  }

  // Leaving the tab pauses a running game rather than letting enemies close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Starshard Arena. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
