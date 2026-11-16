// Keyboard and pointer input. Held keys give a movement vector and a firing state; one-shot
// presses (start, restart, pause, shop choices) are queued and taken once by the loop, so a
// press between two frames is never lost and never counted twice. The mouse position is kept in
// client pixels; the caller converts it to field coordinates with the renderer's view.

export const ACTION_CONFIRM = 1;
export const ACTION_RESTART = 2;
export const ACTION_PAUSE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter', 'Space']);
const RESTART = new Set(['KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const SHOP_KEYS = new Map([['Digit1', 0], ['Digit2', 1], ['Digit3', 2], ['Digit4', 3], ['Numpad1', 0], ['Numpad2', 1], ['Numpad3', 2], ['Numpad4', 3]]);

export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, inside: false };
  let firing = false;
  let actions = 0;
  let shopChoice = -1;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      held.add(event.code);
    } else if (SHOP_KEYS.has(event.code)) {
      if (!event.repeat) shopChoice = SHOP_KEYS.get(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.inside = true;
    firing = true;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    mouse,
    /** True while the mouse button is held down. */
    get firing() {
      return firing;
    },
    /** True while Space is held (keyboard fire) or the mouse button is held. */
    get firingKeyboard() {
      return firing || held.has('Space');
    },
    get dashHeld() {
      return hasAny(DASH);
    },
    /** Normalised movement vector from WASD / arrow keys. */
    moveVector() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The shop key (0-3) pressed since the last call, or -1. */
    takeShopChoice() {
      const choice = shopChoice;
      shopChoice = -1;
      return choice;
    },
  };
}
