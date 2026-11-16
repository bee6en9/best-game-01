// A small seeded random number generator (splitmix32): the same seed gives the same game,
// which is what makes the screenshot scenes repeatable. No Math.random anywhere in the game.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  };
}

/** Pick a value in [min, max) from a random function. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one element of an array from a random function. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}
