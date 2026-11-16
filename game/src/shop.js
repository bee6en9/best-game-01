// The between-wave shop. Shards are the currency; each item gets dearer every time it is
// bought, and each has a cap. Buying never happens outside the shop screen.

export const SHOP_ITEMS = [
  {
    key: '1',
    name: 'Overcharge Rounds',
    detail: '+25% bullet damage',
    baseCost: 8,
    costStep: 5,
    max: 5,
    level(state) {
      return state.player.damageLevel;
    },
    apply(state) {
      state.player.damageLevel += 1;
    },
  },
  {
    key: '2',
    name: 'Ion Thrusters',
    detail: '+12% move speed',
    baseCost: 6,
    costStep: 4,
    max: 5,
    level(state) {
      return state.player.speedLevel;
    },
    apply(state) {
      state.player.speedLevel += 1;
    },
  },
  {
    key: '3',
    name: 'Shield Cell',
    detail: 'Absorbs the next hit',
    baseCost: 10,
    costStep: 4,
    max: 2,
    level(state) {
      return state.player.shield;
    },
    apply(state) {
      state.player.shield += 1;
    },
  },
  {
    key: '4',
    name: 'Spare Hull',
    detail: '+1 life, up to 5',
    baseCost: 25,
    costStep: 10,
    max: 5,
    level(state) {
      return state.player.lives;
    },
    apply(state) {
      state.player.lives += 1;
    },
  },
];

/** What item `index` costs right now: dearer with every one already owned. Lives start at 3, so the first spare hull costs the base price. */
export function itemCost(item, state) {
  const owned = item.level(state);
  const start = item.key === '4' ? 3 : 0;
  return item.baseCost + item.costStep * Math.max(0, owned - start);
}

/** True when the item can still be bought (under its cap and not already maxed). */
export function itemAvailable(item, state) {
  return item.level(state) < item.max;
}

/**
 * Buy item `index` (0-3) with shards. Returns 'bought', 'poor' (not enough shards) or 'max'
 * (already at the cap).
 */
export function buyItem(state, index) {
  const item = SHOP_ITEMS[index];
  if (!item) return 'none';
  if (!itemAvailable(item, state)) return 'max';
  const cost = itemCost(item, state);
  if (state.shards < cost) return 'poor';
  state.shards -= cost;
  item.apply(state);
  state.audio.buy();
  return 'bought';
}
