// Solmar Bay — deterministic seeded random numbers.
// One clear job: every "random" choice in the world comes from here,
// so the same seed always builds the same city and the same screenshots.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    // Deterministic pick that does not depend on call order elsewhere.
    pickSeeded(list, salt) {
      const r = mulberry32((seed ^ Math.imul(salt, 2654435761)) >>> 0);
      return list[Math.floor(r() * list.length)];
    },
  };
}
