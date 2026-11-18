// The wanted system: stars 0-5, police cars that spawn off-screen and chase the
// player, foot cops at higher levels, and a slow fade when the player stays clean
// and out of sight.
import { WANTED, WORLD } from './config.js';
import { resolveBuildingCollision } from './city.js';
import { createCar } from './vehicles.js';

export function createPolice() {
  return {
    level: 0,
    heat: 0, // seconds since the last crime
    quietTime: 0, // seconds with no crime and no cop nearby
    cars: [], // police cars (entities in world.cars, flagged kind 'police')
    footCops: [],
    spawnTimer: 0,
  };
}

export function addWanted(police, amount, reason) {
  if (amount <= 0) return;
  police.level = Math.min(5, police.level + amount);
  police.heat = 0;
  police.quietTime = 0;
  police.lastReason = reason ?? '';
}

export function wantedCarCount(level) {
  if (level <= 0) return 0;
  return Math.min(WANTED.maxPoliceCars, level + 1);
}

export function wantedFootCopCount(level) {
  if (level < 2) return 0;
  return Math.min(4, level - 1);
}

function spawnPointNear(player, rng, minDist) {
  // Just off the visible edge: pick a road point roughly minDist away, clamped in.
  const angle = rng.range(0, Math.PI * 2);
  const dist = minDist + rng.range(0, 260);
  const x = Math.max(80, Math.min(WORLD.width - 80, player.x + Math.cos(angle) * dist));
  const y = Math.max(80, Math.min(WORLD.height - 80, player.y + Math.sin(angle) * dist));
  return { x, y };
}

/** Keep the police presence matched to the wanted level; chase the player. */
export function updatePolice(police, dt, world, rng) {
  const player = world.player;
  const playerPos = player.car ?? player;
  police.heat += dt;

  // Fade: one star per WANTED.decaySeconds while clean and unseen.
  const anyCopNear = police.cars.some((c) => Math.hypot(c.x - playerPos.x, c.y - playerPos.y) < 520)
    || police.footCops.some((c) => Math.hypot(c.x - playerPos.x, c.y - playerPos.y) < 420);
  if (police.level > 0 && police.heat > 8 && !anyCopNear) {
    police.quietTime += dt;
    if (police.quietTime >= WANTED.decaySeconds) {
      police.level -= 1;
      police.quietTime = 0;
    }
  } else {
    police.quietTime = 0;
  }

  // Spawn / despawn police cars.
  const wantCars = wantedCarCount(police.level);
  police.spawnTimer -= dt;
  if (police.cars.length < wantCars && police.spawnTimer <= 0) {
    const p = spawnPointNear(playerPos, rng, 700);
    const car = createCar(p.x, p.y, 0, '#e8e8e8', 'police');
    car.targetSpeed = WANTED.chaseSpeed;
    police.cars.push(car);
    world.cars.push(car);
    police.spawnTimer = 1.2;
  }
  if (police.cars.length > wantCars) {
    const extra = police.cars.pop();
    const idx = world.cars.indexOf(extra);
    if (idx !== -1) world.cars.splice(idx, 1);
  }

  // Foot cops.
  const wantCops = wantedFootCopCount(police.level);
  if (police.footCops.length < wantCops && police.spawnTimer <= 0) {
    const p = spawnPointNear(playerPos, rng, 420);
    const cop = { x: p.x, y: p.y, angle: 0, speed: 0, kind: 'cop', shirt: '#1d2f4a', walkSpeed: 195, state: 'chase', targetX: p.x, targetY: p.y, retarget: 0, downTimer: 0, scared: 0, arrestTimer: 0 };
    police.footCops.push(cop);
    world.peds.push(cop);
    police.spawnTimer = 1.5;
  }
  if (police.footCops.length > wantCops) {
    const extra = police.footCops.pop();
    const idx = world.peds.indexOf(extra);
    if (idx !== -1) world.peds.splice(idx, 1);
  }

  // Police cars chase: steer toward the player, ram on contact (once a second).
  for (const car of police.cars) {
    car.ramTimer = Math.max(0, (car.ramTimer ?? 0) - dt);
    const dx = playerPos.x - car.x;
    const dy = playerPos.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let turn = wantAngle - car.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, turn));
    const target = dist > 320 ? WANTED.chaseSpeed : WANTED.chaseSpeed * 0.8;
    car.speed += Math.max(-700 * dt, Math.min(600 * dt, target - car.speed));
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Police cut corners across blocks, but they cannot drive through buildings.
    const resolved = resolveBuildingCollision(world.city, nx, ny, 20);
    car.x = Math.max(30, Math.min(WORLD.width - 30, resolved.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, resolved.y));
    // Ramming the player's car damages it; ramming the player on foot hurts them.
    if (dist < 42 && car.ramTimer <= 0 && world.onRam) {
      car.ramTimer = 1;
      world.onRam(car, dist);
    }
  }
}
