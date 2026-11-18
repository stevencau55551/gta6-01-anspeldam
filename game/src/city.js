// The city of Azure Bay: a road grid, building blocks, parks, the beach and the bay.
// Generation is deterministic for a seed, so a screenshot run rebuilds the same city.
import { BEACH_W, DISTRICTS, PALETTE, ROAD_W, ROAD_X, ROAD_Y, WATER_W, WORLD } from './config.js';

const DOWNTOWN_COLORS = ['#c9a37e', '#b08a6a', '#d9b48f', '#a8b8c8', '#c2c8d4', '#8fa8bf'];
const DOWNTOWN_ROOFS = ['#5b7a94', '#7a6a8a', '#4a6a7a', '#8a7a5a'];
const OLDTOWN_COLORS = ['#e0b48a', '#d9a06a', '#c98f5f', '#e8c9a0', '#b98a6a'];
const SUBURB_COLORS = ['#d9c9a8', '#c9b896', '#e8dcc0', '#b8c9a8'];
const INDUSTRIAL_COLORS = ['#9a9a92', '#8a8a84', '#a89a7a', '#7a7a72'];

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

function paletteFor(style, rng) {
  switch (style) {
    case 'downtown':
      return { wall: rng.pick(DOWNTOWN_COLORS), roof: rng.pick(DOWNTOWN_ROOFS) };
    case 'oldtown':
      return { wall: rng.pick(OLDTOWN_COLORS), roof: rng.pick(['#7a4a3a', '#5a6a4a', '#8a6a4a']) };
    case 'industrial':
      return { wall: rng.pick(INDUSTRIAL_COLORS), roof: rng.pick(['#5a5a52', '#6a6a60']) };
    case 'suburb':
      return { wall: rng.pick(SUBURB_COLORS), roof: rng.pick(['#a85a4a', '#7a8a6a', '#8a7a5a']) };
    default:
      return { wall: rng.pick(OLDTOWN_COLORS), roof: rng.pick(['#7a8a6a', '#a85a4a']) };
  }
}

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const palms = [];
  const plazas = [];

  // One block per cell between neighbouring road centre lines. The block's inner
  // rectangle (roads + sidewalk stripped off) is split into 1-4 buildings, a park,
  // or a plaza, depending on the district.
  for (let ix = 0; ix < ROAD_X.length; ix += 1) {
    for (let iy = 0; iy < ROAD_Y.length; iy += 1) {
      const x0 = ROAD_X[ix] + ROAD_W / 2 + 14;
      const x1 = (ix + 1 < ROAD_X.length ? ROAD_X[ix + 1] : WORLD.width) - ROAD_W / 2 - 14;
      const y0 = ROAD_Y[iy] + ROAD_W / 2 + 14;
      const y1 = (iy + 1 < ROAD_Y.length ? ROAD_Y[iy + 1] : WORLD.height) - ROAD_W / 2 - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      if (x0 < BEACH_W + 30) continue; // the beach strip stays open

      const roll = rng.next();
      if (district.style === 'beach' && roll < 0.35) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 5; p += 1) {
          palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20) });
        }
        continue;
      }
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 4; p += 1) {
          palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20) });
        }
        continue;
      }
      if (roll < 0.2) {
        plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = district.style === 'downtown' ? 2 : rng.int(1, 2);
      const rows = district.style === 'downtown' ? 2 : rng.int(1, 2);
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (rng.chance(0.12)) continue; // an empty lot keeps the city breathing
          const bx = x0 + c * cw + 8;
          const by = y0 + r * ch + 8;
          const bw = cw - 16 - rng.range(0, 30);
          const bh = ch - 16 - rng.range(0, 30);
          if (bw < 40 || bh < 40) continue;
          const pal = paletteFor(district.style, rng);
          const height = district.style === 'downtown' ? rng.range(26, 60) : district.style === 'industrial' ? rng.range(8, 18) : rng.range(10, 26);
          buildings.push({ x: bx, y: by, w: bw, h: bh, height, wall: pal.wall, roof: pal.roof, district: district.name });
        }
      }
    }
  }

  // Coral Plaza (the big park in Old Town) and palms along the beach promenade.
  parks.push({ x: 1500, y: 1100, w: 280, h: 280 });
  for (let y = 120; y < WORLD.height - 60; y += 130) {
    palms.push({ x: BEACH_W + 26, y: y + rng.range(-20, 20) });
  }
  // Palms down the main avenue.
  for (let x = 300; x < WORLD.width - 100; x += 260) {
    palms.push({ x, y: ROAD_Y[0] - ROAD_W / 2 - 12 });
  }

  return { buildings, parks, plazas, palms, districts: DISTRICTS };
}

// --- Queries the rest of the game uses -------------------------------------

export function isWater(x, y) {
  return x < WATER_W && y >= 0 && y <= WORLD.height;
}

export function isBeach(x, y) {
  return x >= WATER_W && x < BEACH_W;
}

export function isOnRoad(x, y) {
  if (x < BEACH_W) return false;
  for (const rx of ROAD_X) {
    if (Math.abs(x - rx) < ROAD_W / 2) return true;
  }
  for (const ry of ROAD_Y) {
    if (Math.abs(y - ry) < ROAD_W / 2) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let bestX = ROAD_X[0];
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      bestX = rx;
    }
  }
  let bestY = ROAD_Y[0];
  bestD = Infinity;
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      bestY = ry;
    }
  }
  return { x: bestX, y: bestY };
}

/** Push a circle (x, y, r) out of every building it overlaps; returns corrected pos. */
export function resolveBuildingCollision(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else {
      // Centre inside the building: shove out along the smallest penetration axis.
      const left = x - b.x + r;
      const right = b.x + b.w - x + r;
      const top = y - b.y + r;
      const bottom = b.y + b.h - y + r;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x - r;
      else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  return { x, y };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** A free patch of road near (x, y) for spawning a car. */
export function roadSpawnNear(city, rng, x, y) {
  const p = nearestRoadPoint(x, y);
  return { x: p.x + rng.range(-30, 30), y: p.y + rng.range(-30, 30) };
}

export { PALETTE };
