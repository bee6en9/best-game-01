// Drawing only: the game state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Vector
// shapes with a glow, canvas text for the HUD and the panels. Nothing here changes the state.

import { FIELD, FONT, PALETTE } from './config.js';
import { SHOP_ITEMS, itemAvailable, itemCost } from './shop.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_SHOP = 'shop';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';
export const SCREEN_PAUSED = 'paused';

const PANEL = { width: 640, line: 32 };
const STAR_COUNT = 110;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.dpr = ratio;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function glow(color, blur) {
    context.shadowColor = color;
    context.shadowBlur = blur;
  }

  function noGlow() {
    context.shadowBlur = 0;
  }

  function polygon(cx, cy, radius, sides, rotation) {
    context.beginPath();
    for (let index = 0; index < sides; index += 1) {
      const angle = rotation + (index / sides) * Math.PI * 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  }

  function drawBackground(state) {
    context.fillStyle = PALETTE.field;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Faint grid, so the arena reads as a space dock rather than a void.
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
    // Stars, twinkling on the simulation clock so a screenshot is repeatable.
    for (const star of state.stars) {
      const alpha = 0.35 + 0.35 * Math.sin(state.elapsed * star.twinkle + star.phase);
      context.fillStyle = `rgba(238, 241, 255, ${alpha.toFixed(3)})`;
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    // Arena edge, a cyan hairline with an ember corner marker set.
    context.strokeStyle = PALETTE.cyan;
    context.globalAlpha = 0.5;
    context.lineWidth = 2;
    context.strokeRect(6, 6, FIELD.width - 12, FIELD.height - 12);
    context.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const pulse = 1 + 0.18 * Math.sin(state.elapsed * 6 + pickup.x);
      glow(PALETTE.shard, 12);
      context.fillStyle = PALETTE.shard;
      polygon(pickup.x, pickup.y, 7 * pulse, 4, state.elapsed * 2);
      context.fill();
      noGlow();
    }
  }

  function drawEnemy(state, enemy) {
    const flashing = enemy.flash > 0;
    const body = flashing ? '#ffffff' : undefined;
    if (enemy.kind === 'drifter') {
      glow(PALETTE.ember, 14);
      context.fillStyle = body ?? PALETTE.ember;
      polygon(enemy.x, enemy.y, enemy.radius, 4, Math.atan2(enemy.vy, enemy.vx));
      context.fill();
      noGlow();
      context.fillStyle = PALETTE.backdrop;
      polygon(enemy.x, enemy.y, enemy.radius * 0.45, 4, Math.atan2(enemy.vy, enemy.vx));
      context.fill();
    } else if (enemy.kind === 'spinner') {
      glow(PALETTE.violet, 14);
      context.fillStyle = body ?? PALETTE.violet;
      polygon(enemy.x, enemy.y, enemy.radius, 6, enemy.angle);
      context.fill();
      noGlow();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(enemy.x - Math.cos(enemy.angle) * enemy.radius, enemy.y - Math.sin(enemy.angle) * enemy.radius);
      context.lineTo(enemy.x + Math.cos(enemy.angle) * enemy.radius, enemy.y + Math.sin(enemy.angle) * enemy.radius);
      context.stroke();
      context.fillStyle = PALETTE.backdrop;
      context.beginPath();
      context.arc(enemy.x, enemy.y, 4, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'splitter') {
      glow(PALETTE.emberLight, 14);
      context.fillStyle = body ?? PALETTE.emberLight;
      polygon(enemy.x, enemy.y, enemy.radius, 4, enemy.angle);
      context.fill();
      noGlow();
      context.strokeStyle = PALETTE.backdrop;
      context.lineWidth = 3;
      polygon(enemy.x, enemy.y, enemy.radius * 0.55, 4, enemy.angle);
      context.stroke();
    } else if (enemy.kind === 'mini') {
      glow(PALETTE.ember, 10);
      context.fillStyle = body ?? PALETTE.ember;
      polygon(enemy.x, enemy.y, enemy.radius, 3, Math.atan2(enemy.vy, enemy.vx));
      context.fill();
      noGlow();
    } else if (enemy.kind === 'boss') {
      glow(PALETTE.violet, 26);
      context.fillStyle = body ?? PALETTE.violet;
      polygon(enemy.x, enemy.y, enemy.radius, 8, enemy.angle);
      context.fill();
      noGlow();
      context.strokeStyle = PALETTE.ember;
      context.lineWidth = 3;
      polygon(enemy.x, enemy.y, enemy.radius * 0.78, 8, -enemy.angle * 1.4);
      context.stroke();
      glow(PALETTE.ember, 18);
      context.fillStyle = PALETTE.ember;
      context.beginPath();
      context.arc(enemy.x, enemy.y, 16 + 3 * Math.sin(state.elapsed * 5), 0, Math.PI * 2);
      context.fill();
      noGlow();
      // Boss health bar, pinned above the golem.
      const width = 170;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      context.fillStyle = PALETTE.panel;
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 26, width, 10);
      context.fillStyle = ratio > 0.4 ? PALETTE.ember : PALETTE.danger;
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 26, width * ratio, 10);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0 && player.dashTimer <= 0) return;
    const angle = player.angle;
    const noseX = player.x + Math.cos(angle) * 20;
    const noseY = player.y + Math.sin(angle) * 20;
    const leftX = player.x + Math.cos(angle + 2.5) * 15;
    const leftY = player.y + Math.sin(angle + 2.5) * 15;
    const rightX = player.x + Math.cos(angle - 2.5) * 15;
    const rightY = player.y + Math.sin(angle - 2.5) * 15;
    const backX = player.x + Math.cos(angle + Math.PI) * 8;
    const backY = player.y + Math.sin(angle + Math.PI) * 8;
    // Engine flame, flickering with the simulation clock.
    if (player.thrust > 0.1 || player.dashTimer > 0) {
      const flame = 12 + 8 * Math.sin(state.elapsed * 31) * player.thrust + (player.dashTimer > 0 ? 14 : 0);
      glow(PALETTE.ember, 16);
      context.fillStyle = PALETTE.ember;
      context.beginPath();
      context.moveTo(leftX, leftY);
      context.lineTo(backX - Math.cos(angle) * flame, backY - Math.sin(angle) * flame);
      context.lineTo(rightX, rightY);
      context.closePath();
      context.fill();
      noGlow();
    }
    glow(PALETTE.cyan, 18);
    context.fillStyle = '#0e2a3a';
    context.beginPath();
    context.moveTo(noseX, noseY);
    context.lineTo(leftX, leftY);
    context.lineTo(backX, backY);
    context.lineTo(rightX, rightY);
    context.closePath();
    context.fill();
    context.strokeStyle = PALETTE.cyan;
    context.lineWidth = 2;
    context.stroke();
    noGlow();
    context.fillStyle = PALETTE.cyan;
    context.beginPath();
    context.arc(player.x, player.y, 4, 0, Math.PI * 2);
    context.fill();
    // Shield ring while a cell is held.
    if (player.shield > 0) {
      context.strokeStyle = PALETTE.cyan;
      context.globalAlpha = 0.55 + 0.2 * Math.sin(state.elapsed * 4);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function drawBullets(state) {
    for (const bullet of state.bullets) {
      glow(PALETTE.cyan, 10);
      context.strokeStyle = PALETTE.cyan;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
    }
    noGlow();
    for (const bullet of state.enemyBullets) {
      glow(PALETTE.danger, 12);
      context.fillStyle = PALETTE.danger;
      context.beginPath();
      context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      context.fill();
    }
    noGlow();
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    context.globalAlpha = 1;
  }

  function drawAim(state) {
    if (!state.aimVisible) return;
    const aim = state.aim;
    context.strokeStyle = PALETTE.cyan;
    context.globalAlpha = 0.8;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(aim.x, aim.y, 11, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(aim.x - 17, aim.y);
    context.lineTo(aim.x - 6, aim.y);
    context.moveTo(aim.x + 6, aim.y);
    context.lineTo(aim.x + 17, aim.y);
    context.moveTo(aim.x, aim.y - 17);
    context.lineTo(aim.x, aim.y - 6);
    context.moveTo(aim.x, aim.y + 6);
    context.lineTo(aim.x, aim.y + 17);
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    const player = state.player;
    context.textBaseline = 'top';
    // Hull bar, top left, with lives pips beneath it.
    text('HULL', 24, 18, 15, PALETTE.muted, 'left', 'top');
    const barX = 24;
    const barY = 40;
    const barWidth = 220;
    context.fillStyle = PALETTE.panel;
    context.fillRect(barX, barY, barWidth, 16);
    const hullRatio = Math.max(0, player.hull / player.maxHull);
    context.fillStyle = hullRatio > 0.5 ? PALETTE.hull : hullRatio > 0.25 ? PALETTE.ember : PALETTE.danger;
    context.fillRect(barX, barY, barWidth * hullRatio, 16);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barWidth, 16);
    text(`${Math.ceil(player.hull)}`, barX + barWidth + 10, 38, 17, PALETTE.text, 'left', 'top');
    for (let index = 0; index < player.lives; index += 1) {
      glow(PALETTE.cyan, 8);
      context.fillStyle = PALETTE.cyan;
      polygon(barX + 10 + index * 24, 74, 8, 3, -Math.PI / 2);
      context.fill();
    }
    noGlow();
    // Dash readiness, under the lives.
    const dashReady = player.dashCooldown <= 0;
    text(dashReady ? 'DASH READY [Shift]' : 'DASH …', barX, 92, 14, dashReady ? PALETTE.cyan : PALETTE.muted, 'left', 'top');
    // Wave, top centre.
    text(`WAVE ${state.wave} / 10`, FIELD.width / 2, 18, 26, PALETTE.text, 'center', 'top');
    if (state.boss !== null) text('⚠ SHARD-GOLEM ⚠', FIELD.width / 2, 50, 16, PALETTE.danger, 'center', 'top');
    // Score, shards and combo, top right.
    text(`SCORE ${state.score}`, FIELD.width - 24, 18, 22, PALETTE.text, 'right', 'top');
    text(`◆ ${state.shards}`, FIELD.width - 24, 46, 20, PALETTE.shard, 'right', 'top');
    if (state.combo > 1) {
      text(`COMBO x${state.multiplier.toFixed(1)} (${state.combo})`, FIELD.width - 24, 74, 18, PALETTE.emberLight, 'right', 'top');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const lineHeight = 30;
    const height = 150 + lines.length * lineHeight;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent ?? PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 122 + index * lineHeight, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.emberLight, 'center');
  }

  function drawShop(state) {
    const lines = ['The wave is clear. Spend shards before the next one.', ''];
    const height = 210 + SHOP_ITEMS.length * 56;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.cyan;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text('WAVE CLEAR — ARMOURY', FIELD.width / 2, y + 62, 34, PALETTE.text, 'center');
    text(lines[0], FIELD.width / 2, y + 100, 19, PALETTE.muted, 'center');
    text(`◆ ${state.shards} shards`, FIELD.width / 2, y + 128, 20, PALETTE.shard, 'center');
    for (let index = 0; index < SHOP_ITEMS.length; index += 1) {
      const item = SHOP_ITEMS[index];
      const cost = itemCost(item, state);
      const available = itemAvailable(item, state);
      const afford = state.shards >= cost;
      const rowY = y + 168 + index * 56;
      context.fillStyle = available ? (afford ? PALETTE.text : PALETTE.muted) : PALETTE.muted;
      text(`[${item.key}] ${item.name}`, x + 36, rowY, 21, available ? (afford ? PALETTE.text : PALETTE.muted) : PALETTE.muted, 'left');
      text(item.detail, x + 36, rowY + 24, 16, PALETTE.muted, 'left');
      const right = available ? `◆ ${cost}` : 'MAX';
      text(right, x + PANEL.width - 36, rowY, 21, available ? (afford ? PALETTE.shard : PALETTE.danger) : PALETTE.muted, 'right');
    }
    text(`Press Enter to launch wave ${state.wave + 1}`, FIELD.width / 2, y + height - 30, 21, PALETTE.emberLight, 'center');
  }

  /** Paint one frame: the field, the actors, the HUD, then the panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawBackground(state);
    drawPickups(state);
    for (const enemy of state.enemies) drawEnemy(state, enemy);
    if (screen !== SCREEN_TITLE) drawPlayer(state);
    drawBullets(state);
    drawParticles(state);
    if (screen === SCREEN_PLAY) drawAim(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('STARSHARD ARENA', [
        'Pilot a shard-ship through 10 waves of drifters, spinners and splitters.',
        'Collect shards, buy upgrades between waves, and shatter the wave-10 golem.',
        'WASD / arrows to move · mouse to aim · hold click or Space to fire',
        'Shift to dash · 1-4 to buy in the shop · P to pause',
        `Best score: ${best}`,
      ], 'Press Enter or click to launch');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_SHOP) drawShop(state);
    else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The arena waits for you.'], 'Press P or Enter to resume');
    } else if (screen === SCREEN_VICTORY) {
      drawPanel('VICTORY', [
        'The wave-10 shard-golem is shattered. The arena is yours.',
        `Final score: ${state.score}`,
        `Best score: ${best}`,
        '',
      ], 'Press R or click to play again', PALETTE.cyan);
    } else if (screen === SCREEN_OVER) {
      drawPanel('GAME OVER', [
        `The arena claimed your ship on wave ${state.wave}.`,
        `Final score: ${state.score}`,
        `Best score: ${best}`,
        '',
      ], 'Press R or click to try again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Convert a client-pixel point to field coordinates. */
    screenToField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) * view.dpr - view.x) / view.scale,
        y: ((clientY - rect.top) * view.dpr - view.y) / view.scale,
      };
    },
  };
}
