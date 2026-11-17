// Solmar Bay — the city itself: road grid, blocks, buildings, parks,
// beach and ocean, plus the collision and road helpers everyone uses.
// One clear job: build a fixed, seeded city and answer "what is here?".

import { WORLD, PALETTE } from './config.js';
import { makeRng } from './rng.js';

export const AVENUES = [];
for (let x = 150; x <= 3450; x += 300) AVENUES.push(x);
export const STREETS = [];
for (let y = 150; y <= 2550; y += 300) STREETS.push(y);

function districtAt(x, y) {
  if (y >= 2100) return 'marina';
  if (x >= 2400 && y < 900) return 'hills';
  if (x >= 2400) return 'industrial';
  if (x >= 900 && x < 2100 && y >= 600 && y < 1800) return 'downtown';
  if (x < 900 && y < 1200) return 'oldtown';
  return 'midtown';
}

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    seed,
    avenues: AVENUES,
    streets: STREETS,
    buildings: [],
    parks: [],
    lots: [],
    trees: [],
    lamps: [],
    piers: [],
    places: {},
    stashes: [],
  };

  // Blocks: the rectangles between neighbouring roads.
  const blocks = [];
  for (let i = 0; i < AVENUES.length - 1; i += 1) {
    for (let j = 0; j < STREETS.length - 1; j += 1) {
      const x0 = AVENUES[i] + WORLD.roadWidth / 2;
      const y0 = STREETS[j] + WORLD.roadWidth / 2;
      const x1 = AVENUES[i + 1] - WORLD.roadWidth / 2;
      const y1 = STREETS[j + 1] - WORLD.roadWidth / 2;
      blocks.push({ x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
  }

  for (const b of blocks) {
    const d = districtAt(b.cx, b.cy);
    const roll = rng.next();
    if (roll < 0.10) {
      city.parks.push({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
      const n = rng.int(4, 8);
      for (let k = 0; k < n; k += 1) {
        city.trees.push({ x: rng.range(b.x0 + 16, b.x1 - 16), y: rng.range(b.y0 + 16, b.y1 - 16), r: rng.range(9, 15) });
      }
      continue;
    }
    if (roll < 0.17) {
      city.lots.push({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
      continue;
    }
    const tall = d === 'downtown';
    const low = d === 'hills' || d === 'marina' || d === 'oldtown';
    const count = rng.chance(0.55) ? 1 : (rng.chance(0.6) ? 2 : 4);
    const cols = count === 4 ? 2 : (count === 2 ? 2 : 1);
    const rows = count === 4 ? 2 : 1;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const bw = (b.x1 - b.x0) / cols - 18;
        const bh = (b.y1 - b.y0) / rows - 18;
        const bx = b.x0 + 9 + c * ((b.x1 - b.x0) / cols);
        const by = b.y0 + 9 + r * ((b.y1 - b.y0) / rows);
        const hgt = tall ? rng.range(34, 72) : (low ? rng.range(8, 18) : rng.range(14, 34));
        city.buildings.push({
          x: bx, y: by, w: bw, h: bh, hgt,
          roof: rng.pick(ROOFS),
          wall: PALETTE.buildingWall,
          district: d,
        });
      }
    }
    if (d === 'hills' || d === 'oldtown') {
      city.trees.push({ x: b.x0 + 12, y: b.y0 + 12, r: 11 });
      city.trees.push({ x: b.x1 - 12, y: b.y1 - 12, r: 10 });
    }
  }

  // Street lamps along every road, every 300 px, offset to the kerb.
  for (const x of AVENUES) {
    for (const y of STREETS) {
      if (rng.chance(0.5)) city.lamps.push({ x: x + WORLD.roadWidth / 2 + 8, y: y + 14 });
    }
  }

  // Named places the story uses. Each sits on a road so missions can reach it.
  const place = (name, ax, ay, label) => {
    city.places[name] = { x: AVENUES[ax], y: STREETS[ay], label };
  };
  place('garage', 3, 2, "Rook's Garage");
  place('club', 5, 4, 'Club Lumen');
  place('bank', 6, 3, 'Solmar National Bank');
  place('warehouse', 10, 5, 'Warehouse 9');
  place('marina', 5, 8, 'Marina Boardwalk');
  place('hospital', 2, 6, 'St. Anselm Hospital');
  place('policeHQ', 4, 1, 'SPD Headquarters');
  place('safehouse', 8, 7, 'Safehouse');
  place('chopshop', 9, 6, 'Chop Shop');
  place('lighthouse', 6, 8, 'Lighthouse Pier');
  place('courier', 7, 2, 'Courier Depot');
  place('plaza', 1, 1, 'Old Town Plaza');

  // The lighthouse pier reaches into the ocean from the marina road.
  city.piers.push({ x: AVENUES[6] - 26, y: WORLD.oceanTop - 20, w: 52, h: 260 });

  // Cash stashes: tucked beside landmarks and parks.
  const stashSpots = [
    [AVENUES[3] + 90, STREETS[2] + 90], [AVENUES[5] - 90, STREETS[4] - 90],
    [AVENUES[6] + 90, STREETS[3] + 90], [AVENUES[10] - 90, STREETS[5] + 90],
    [AVENUES[5] + 90, STREETS[8] - 90], [AVENUES[2] - 90, STREETS[6] - 90],
    [AVENUES[4] + 90, STREETS[1] - 90], [AVENUES[8] - 90, STREETS[7] + 90],
    [AVENUES[9] + 90, STREETS[6] - 90], [AVENUES[1] + 90, STREETS[1] + 90],
    [AVENUES[7] + 90, STREETS[2] - 90], [AVENUES[3] - 90, STREETS[7] - 90],
  ];
  city.stashes = stashSpots.map(([x, y], i) => ({ x, y, id: i, taken: false }));

  return city;
}

// --- Queries ---------------------------------------------------------------

export function isOnRoad(city, x, y) {
  for (const ax of city.avenues) if (Math.abs(x - ax) <= WORLD.roadWidth / 2) return true;
  for (const sy of city.streets) if (Math.abs(y - sy) <= WORLD.roadWidth / 2) return true;
  return false;
}

export function isOcean(x, y) {
  return y >= WORLD.oceanTop;
}

export function isBeach(x, y) {
  return y >= WORLD.beachTop && y < WORLD.oceanTop;
}

export function onPier(city, x, y) {
  for (const p of city.piers) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
  }
  return false;
}

/** Nearest point on the road network to (x, y). */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of city.avenues) {
    for (const sy of city.streets) {
      // Project onto the avenue segment and the street segment.
      const py = Math.max(150, Math.min(2550, y));
      const d1 = (x - ax) * (x - ax) + (y - py) * (y - py);
      if (d1 < bestD) { bestD = d1; best = { x: ax, y: py }; }
      const px = Math.max(150, Math.min(3450, x));
      const d2 = (x - px) * (x - px) + (y - sy) * (y - sy);
      if (d2 < bestD) { bestD = d2; best = { x: px, y: sy }; }
    }
  }
  return best;
}

/** A random point on a road, between minD and maxD from (x, y). */
export function randomRoadPoint(rng, city, x, y, minD, maxD) {
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = rng.chance(0.5);
    let px; let py;
    if (vertical) {
      px = rng.pick(city.avenues);
      py = rng.range(150, 2550);
    } else {
      px = rng.range(150, 3450);
      py = rng.pick(city.streets);
    }
    const d = Math.hypot(px - x, py - y);
    if (d >= minD && d <= maxD) return { x: px, y: py };
  }
  return nearestRoadPoint(city, x, y);
}

export function nearestIntersection(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of city.avenues) {
    for (const sy of city.streets) {
      const d = (x - ax) * (x - ax) + (y - sy) * (y - sy);
      if (d < bestD) { bestD = d; best = { x: ax, y: sy }; }
    }
  }
  return best;
}

// --- Collision -------------------------------------------------------------

/** Push a circle out of every solid rect; returns the corrected position. */
export function resolveCircle(city, x, y, r) {
  let nx = x; let ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx; const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest penetration.
        const pl = nx - b.x + r; const pr = b.x + b.w - nx + r;
        const pt = ny - b.y + r; const pb = b.y + b.h - ny + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = b.x - r;
        else if (m === pr) nx = b.x + b.w + r;
        else if (m === pt) ny = b.y - r;
        else ny = b.y + b.h + r;
      }
    }
  }
  // Ocean is solid except on the pier.
  if (isOcean(nx, ny) && !onPier(city, nx, ny)) ny = WORLD.oceanTop - r;
  nx = Math.max(r, Math.min(WORLD.width - r, nx));
  ny = Math.max(r, Math.min(WORLD.height - r, ny));
  return { x: nx, y: ny };
}

/** Push a car's corners out of buildings; returns true when it hit something. */
export function resolveCar(city, car) {
  const def = car.def;
  const hw = def.len / 2; const hh = def.wid / 2;
  const cos = Math.cos(car.angle); const sin = Math.sin(car.angle);
  let hit = false;
  for (const b of city.buildings) {
    // Car centre in the building's local frame is enough for an arcade push-out:
    // test the four corners, push along the smallest penetration axis.
    const corners = [
      [hw, hh], [hw, -hh], [-hw, hh], [-hw, -hh],
    ];
    for (const [lx, ly] of corners) {
      const wx = car.x + lx * cos - ly * sin;
      const wy = car.y + lx * sin + ly * cos;
      if (wx > b.x && wx < b.x + b.w && wy > b.y && wy < b.y + b.h) {
        const pl = wx - b.x; const pr = b.x + b.w - wx;
        const pt = wy - b.y; const pb = b.y + b.h - wy;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) car.x -= pl + 1;
        else if (m === pr) car.x += pr + 1;
        else if (m === pt) car.y -= pt + 1;
        else car.y += pb + 1;
        car.speed *= 0.55;
        hit = true;
      }
    }
  }
  if (isOcean(car.x, car.y)) {
    car.y = WORLD.oceanTop - hh - 2;
    car.speed *= 0.5;
    hit = true;
  }
  car.x = Math.max(hw, Math.min(WORLD.width - hw, car.x));
  car.y = Math.max(hh, Math.min(WORLD.height - hh, car.y));
  return hit;
}
