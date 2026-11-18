// Cars: one arcade physics model for the player's car and a road-following AI for
// traffic and police. A car is a circle for collisions (radius 20) and a rotated
// rectangle for drawing; that split keeps the physics cheap and stable.
import { CAR, ROAD_W, ROAD_X, ROAD_Y, WORLD } from './config.js';
import { isOnRoad, resolveBuildingCollision } from './city.js';

let nextId = 1;

export function createCar(x, y, angle, color, kind) {
  return {
    id: nextId,
    kind: kind ?? 'traffic', // traffic | player | police | parked
    x,
    y,
    angle,
    speed: 0,
    color,
    health: 100,
    driver: kind === 'traffic',
    stolen: false,
    // Traffic AI state:
    axis: 'x', // 'x' = travels along a horizontal road (moves in x), 'y' = vertical road
    dir: 1,
    targetSpeed: 0,
    stuck: 0,
    smoke: 0,
  };
}

export function carRadius() {
  return 20;
}

function clampSpeed(car, max) {
  if (car.speed > max) car.speed = max;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
}

/** Player driving: throttle/steer from input, with drift-lite arcade handling. */
export function updatePlayerCar(car, drive, dt, city) {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  if (drive.throttle > 0) car.speed += CAR.accel * dt;
  else if (drive.throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  } else {
    car.speed -= car.speed * 1.6 * dt; // rolling drag
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (drive.brake) car.speed -= car.speed * 4 * dt;
  clampSpeed(car, CAR.maxSpeed);
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
  const reverse = car.speed < 0 ? -1 : 1;
  car.angle += drive.steer * CAR.turnRate * steerAuthority * reverse * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const resolved = resolveBuildingCollision(city, nx, ny, carRadius());
  const hitWall = resolved.x !== nx || resolved.y !== ny;
  if (hitWall) {
    car.speed *= 0.55;
    car.health -= Math.abs(car.speed) * 0.02;
  }
  car.x = Math.max(30, Math.min(WORLD.width - 30, resolved.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, resolved.y));
  car.smoke = car.health < 45 ? 1 : 0;
  return { hitWall, forward };
}

/** Traffic AI: cruise along its road; at a crossing, sometimes turn. */
export function updateTrafficCar(car, rng, dt, city, cars) {
  if (car.targetSpeed === 0) car.targetSpeed = rng.range(150, 230);
  // Slow down for a car ahead in the same lane.
  let blocked = false;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (ahead > 0 && ahead < 85 && side < 30) {
      blocked = true;
      break;
    }
  }
  const want = blocked ? 0 : car.targetSpeed;
  car.speed += Math.max(-400 * dt, Math.min(260 * dt, want - car.speed));

  // At a crossing, roll to turn onto the other axis (keep right-hand lanes).
  const nearCrossing = (axisList, value) => {
    for (const c of axisList) {
      if (Math.abs(value - c) < 12) return c;
    }
    return null;
  };
  if (car.axis === 'x') {
    const cross = nearCrossing(ROAD_X, car.x);
    if (cross !== null && rng.chance(0.25)) {
      car.axis = 'y';
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
    }
  } else {
    const cross = nearCrossing(ROAD_Y, car.y);
    if (cross !== null && rng.chance(0.25)) {
      car.axis = 'x';
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
    }
  }

  // Gentle lane keeping: drift back toward the centre line of the current road.
  const laneOffset = 22;
  if (car.axis === 'x') {
    const roadY = nearestRoadY(car.y);
    const targetY = roadY + (car.dir > 0 ? laneOffset : -laneOffset);
    car.y += (targetY - car.y) * 0.6 * dt;
  } else {
    const roadX = nearestRoadX(car.x);
    const targetX = roadX + (car.dir > 0 ? -laneOffset : laneOffset);
    car.x += (targetX - car.x) * 0.6 * dt;
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Off the map edge: wrap to the opposite side so traffic never runs dry.
  if (car.x < 40) car.x = WORLD.width - 60;
  if (car.x > WORLD.width - 40) car.x = 60;
  if (car.y < 40) car.y = WORLD.height - 60;
  if (car.y > WORLD.height - 40) car.y = 60;
  if (!isOnRoad(car.x, car.y)) {
    // Nudged off-road by a collision: steer back to the nearest road.
    const p = nearestPointOnRoad(car.x, car.y);
    car.x += (p.x - car.x) * 0.5 * dt;
    car.y += (p.y - car.y) * 0.5 * dt;
  }
}

function nearestRoadX(x) {
  let best = ROAD_X[0];
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = rx;
    }
  }
  return best;
}

function nearestRoadY(y) {
  let best = ROAD_Y[0];
  let bestD = Infinity;
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      best = ry;
    }
  }
  return best;
}

function nearestPointOnRoad(x, y) {
  return { x: nearestRoadX(x), y: nearestRoadY(y) };
}

/** Circle-vs-circle car collisions: push apart, trade a little speed, spark. */
export function collideCars(cars, onCrash) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = carRadius() * 2 - 4;
      if (d >= min || d < 0.001) continue;
      // A police ram should shove, not glue: extra separation when a cruiser
      // is involved, so a chase reads as a chase and not a pile-up.
      const extra = a.kind === 'police' || b.kind === 'police' ? 8 : 0;
      const push = (min - d) / 2 + extra;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 90) {
        a.health -= impact * 0.02;
        b.health -= impact * 0.02;
        if (onCrash) onCrash((a.x + b.x) / 2, (a.y + b.y) / 2, impact);
      }
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.92;
      b.speed = avg * 0.92;
    }
  }
}

export { ROAD_W };
