// Pedestrians and on-foot police. Pedestrians stroll the sidewalks, flee from danger
// and scream (a sound cue + a wanted risk if a cop sees it). Foot cops chase the
// player and try to arrest them when the wanted level is up.
import { ROAD_X, ROAD_Y } from './config.js';
import { resolveBuildingCollision } from './city.js';

let nextId = 1;

export function createPed(x, y, rng, shirt) {
  return {
    id: nextId,
    kind: 'ped',
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    shirt,
    walkSpeed: rng.range(38, 70),
    state: 'walk', // walk | flee | down
    targetX: x,
    targetY: y,
    retarget: 0,
    downTimer: 0,
    scared: 0,
  };
}

export function createFootCop(x, y) {
  return {
    id: nextId,
    kind: 'cop',
    x,
    y,
    angle: 0,
    speed: 0,
    shirt: '#1d2f4a',
    walkSpeed: 190,
    state: 'chase',
    targetX: x,
    targetY: y,
    retarget: 0,
    downTimer: 0,
    scared: 0,
    arrestTimer: 0,
  };
}

function pickSidewalkTarget(ped, rng) {
  // A random point on a sidewalk: near a road centre line, offset to the side.
  if (rng.chance(0.5)) {
    const road = rng.pick(ROAD_X);
    const y = rng.range(120, 2280);
    return { x: road + (rng.chance(0.5) ? 62 : -62), y };
  }
  const road = rng.pick(ROAD_Y);
  const x = rng.range(220, 3080);
  return { x, y: road + (rng.chance(0.5) ? 62 : -62) };
}

export function updatePed(ped, rng, dt, city, danger) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.state = 'walk';
      ped.scared = 0;
    }
    return;
  }
  // Danger = {x, y, radius}: gunshots, speeding cars, the player punching nearby.
  let fleeing = ped.scared > 0;
  if (danger) {
    const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
    if (d < danger.radius) {
      ped.scared = 2.5;
      fleeing = true;
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      ped.targetX = ped.x + Math.cos(away) * 260;
      ped.targetY = ped.y + Math.sin(away) * 260;
      ped.retarget = 1.2;
    }
  }
  ped.scared = Math.max(0, ped.scared - dt);
  ped.retarget -= dt;
  if (ped.retarget <= 0 && !fleeing) {
    const t = pickSidewalkTarget(ped, rng);
    ped.targetX = t.x;
    ped.targetY = t.y;
    ped.retarget = rng.range(4, 9);
  }
  const dx = ped.targetX - ped.x;
  const dy = ped.targetY - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    ped.speed = 0;
    return;
  }
  const want = Math.atan2(dy, dx);
  let turn = want - ped.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  ped.angle += Math.max(-4 * dt, Math.min(4 * dt, turn));
  const speed = fleeing ? ped.walkSpeed * 2.6 : ped.walkSpeed;
  ped.speed = speed;
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const resolved = resolveBuildingCollision(city, nx, ny, 12);
  ped.x = resolved.x;
  ped.y = resolved.y;
}

export function updateFootCop(cop, dt, city, playerPos, onArrest) {
  if (cop.state === 'down') {
    cop.downTimer -= dt;
    if (cop.downTimer <= 0) cop.state = 'chase';
    return;
  }
  const dx = playerPos.x - cop.x;
  const dy = playerPos.y - cop.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let turn = want - cop.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  cop.angle += Math.max(-5 * dt, Math.min(5 * dt, turn));
  if (dist > 26) {
    cop.speed = cop.walkSpeed;
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const resolved = resolveBuildingCollision(city, nx, ny, 12);
    cop.x = resolved.x;
    cop.y = resolved.y;
    cop.arrestTimer = 0;
  } else {
    // On top of the player: the arrest clock runs.
    cop.speed = 0;
    cop.arrestTimer += dt;
    if (cop.arrestTimer > 1.6 && onArrest) onArrest(cop);
  }
}

/** Knock a person down (punch, bullet, car hit). Returns true if it was a cop. */
export function knockDown(person, seconds) {
  person.state = 'down';
  person.downTimer = seconds;
  person.speed = 0;
  return person.kind === 'cop';
}
