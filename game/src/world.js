// The world: one state object holding everything, and stepWorld, the single
// function that advances it one tick. main.js owns screens and rendering; this
// module owns the rules.
import {
  CAR_COLORS, LANDMARKS, PED_COUNT, PED_SHIRTS, PLAYER, ROAD_X, ROAD_Y,
  TRAFFIC_COUNT, WATER_W, WORLD,
} from './config.js';
import { createRandom } from './random.js';
import { buildCity, isOnRoad, resolveBuildingCollision, roadSpawnNear } from './city.js';
import {
  carRadius, collideCars, createCar, updatePlayerCar, updateTrafficCar,
} from './vehicles.js';
import { createPed, knockDown, updateFootCop, updatePed } from './people.js';
import { addWanted, createPolice, updatePolice } from './police.js';
import {
  createMissions, currentMission, currentStep, onMissionStart, startStory,
  tryInteract, updateMissions,
} from './missions.js';
import {
  addParticle, createCombat, damagePlayer, punch, shoot, spawnPickup,
  updateBullets, updatePickups,
} from './combat.js';
import { ACTION_ENTER_CAR, ACTION_INTERACT, ACTION_PUNCH, ACTION_RELOAD } from './input.js';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const world = {
    seed,
    rng,
    city,
    time: 0,
    viewW: 1280,
    viewH: 720,
    player: {
      x: 700, y: 700, angle: -Math.PI / 2, hp: 100, money: 150,
      ammo: 12, reserve: 48, car: null, punchCooldown: 0, fireCooldown: 0, invuln: 0,
    },
    cars: [],
    peds: [],
    combat: createCombat(),
    particles: [],
    police: createPolice(),
    missions: createMissions(),
    camera: { x: 0, y: 0, shake: 0 },
    stats: { carsStolen: 0, shotsFired: 0, pedsDown: 0, missionsDone: 0 },
    over: null,
    damageFlash: 0,
    pickupTimer: 12,
    bankVanReady: false,
    audio: null,
    events: [],
  };

  world.onRam = (car) => {
    const player = world.player;
    if (player.car) {
      player.car.health -= 8;
      player.car.speed *= 0.6;
      addParticle(world, player.car.x, player.car.y, 'spark', 0.3);
      if (world.audio) world.audio.crash();
      world.camera.shake = 6;
      if (player.car.health <= 0) {
        player.car.health = 0;
        player.car.speed = 0;
      }
    } else {
      damagePlayer(world, 10);
      player.x += Math.cos(car.angle) * 30;
      player.y += Math.sin(car.angle) * 30;
      world.camera.shake = 8;
      if (world.audio) world.audio.crash();
    }
  };
  world.onJobCash = () => {
    world.police.level = 4;
    world.police.heat = 0;
    world.police.quietTime = 0;
  };
  world.onArrest = () => {
    if (!world.over) {
      world.over = 'busted';
      if (world.audio) world.audio.busted();
    }
  };

  spawnTraffic(world, rng);
  spawnPeds(world, rng);
  spawnPickup(world.combat, 'health', 760, 620);
  spawnPickup(world.combat, 'ammo', 880, 760);
  spawnPickup(world.combat, 'cash', 640, 880);
  startStory(world.missions, 0);
  return world;
}

export function resetWorld(world, seed) {
  const fresh = createWorld(seed);
  // Keep the audio hook the main loop attached.
  fresh.audio = world.audio;
  Object.keys(world).forEach((key) => delete world[key]);
  Object.assign(world, fresh);
}

function spawnTraffic(world, rng) {
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const car = spawnOneTrafficCar(world, rng);
    if (car) world.cars.push(car);
  }
  // A few parked cars along the roads — free to take, no owner to object.
  for (let i = 0; i < 6; i += 1) {
    const p = roadSpawnNear(world.city, rng, rng.range(400, 2800), rng.range(400, 2000));
    const parked = createCar(p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), rng.pick(CAR_COLORS), 'parked');
    parked.driver = false;
    world.cars.push(parked);
  }
}

function spawnOneTrafficCar(world, rng) {
  const axis = rng.chance(0.5) ? 'x' : 'y';
  let x;
  let y;
  let angle;
  let dir;
  if (axis === 'x') {
    const road = rng.pick(ROAD_Y);
    x = rng.range(200, WORLD.width - 200);
    y = road + (rng.chance(0.5) ? 22 : -22);
    dir = y > road ? -1 : 1;
    angle = dir > 0 ? 0 : Math.PI;
  } else {
    const road = rng.pick(ROAD_X);
    x = road + (rng.chance(0.5) ? 22 : -22);
    y = rng.range(200, WORLD.height - 200);
    dir = x > road ? 1 : -1;
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  const player = world.player;
  if (Math.hypot(x - player.x, y - player.y) < 260) return null;
  const car = createCar(x, y, angle, rng.pick(CAR_COLORS), 'traffic');
  car.axis = axis;
  car.dir = dir;
  car.targetSpeed = rng.range(150, 230);
  car.speed = car.targetSpeed;
  return car;
}

function spawnPeds(world, rng) {
  for (let i = 0; i < PED_COUNT; i += 1) {
    const x = rng.range(260, WORLD.width - 120);
    const y = rng.range(140, WORLD.height - 120);
    world.peds.push(createPed(x, y, rng, rng.pick(PED_SHIRTS)));
  }
}

function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(world) {
  const player = world.player;
  const car = nearestCar(world, player.x, player.y, 78);
  if (!car) return;
  if (car.kind === 'traffic' && car.driver) {
    // Steal: the driver bails out and runs.
    car.driver = false;
    const driver = createPed(car.x + 30, car.y + 30, world.rng, '#e8e4da');
    driver.scared = 3;
    driver.targetX = car.x + 300;
    driver.targetY = car.y + 300;
    world.peds.push(driver);
    car.stolen = true;
    world.stats.carsStolen += 1;
    addWanted(world.police, 1, 'stole a car');
    if (world.audio) world.audio.horn();
  }
  car.kind = 'player';
  player.car = car;
  player.angle = car.angle;
  world.events.push({ type: 'enterCar' });
}

function exitCar(world) {
  const player = world.player;
  const car = player.car;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  const px = car.x + Math.cos(side) * 46;
  const py = car.y + Math.sin(side) * 46;
  const resolved = resolveBuildingCollision(world.city, px, py, 14);
  player.x = Math.max(WATER_W + 12, resolved.x);
  player.y = resolved.y;
  player.angle = car.angle;
  car.speed = 0;
  car.kind = 'parked';
  car.driver = false;
  player.car = null;
  world.events.push({ type: 'exitCar' });
}

function hitPedByCar(world, car) {
  for (const ped of world.peds) {
    if (ped.state === 'down' || ped.kind === 'cop') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < carRadius() + 12) {
      knockDown(ped, 6);
      world.stats.pedsDown += 1;
      ped.x += Math.cos(car.angle) * 24;
      ped.y += Math.sin(car.angle) * 24;
      addParticle(world, ped.x, ped.y, 'stars', 0.4);
      const copNear = world.police.cars.some((c) => Math.hypot(c.x - ped.x, c.y - ped.y) < 600)
        || world.police.footCops.some((c) => Math.hypot(c.x - ped.x, c.y - ped.y) < 500);
      if (copNear) addWanted(world.police, 1, 'hit a pedestrian');
      if (world.audio) world.audio.crash();
      world.camera.shake = 5;
    }
  }
}

/** Respawn after busted / wasted: hospital, full health, heat gone, cash fine. */
export function respawnPlayer(world) {
  const player = world.player;
  player.hp = 100;
  player.x = LANDMARKS.hospital.x;
  player.y = LANDMARKS.hospital.y - 40;
  player.angle = 0;
  player.invuln = 2;
  if (player.car) {
    player.car.kind = 'parked';
    player.car.speed = 0;
    player.car = null;
  }
  world.police.level = 0;
  world.police.quietTime = 0;
  for (const car of [...world.police.cars]) {
    const idx = world.cars.indexOf(car);
    if (idx !== -1) world.cars.splice(idx, 1);
  }
  world.police.cars = [];
  for (const cop of [...world.police.footCops]) {
    const idx = world.peds.indexOf(cop);
    if (idx !== -1) world.peds.splice(idx, 1);
  }
  world.police.footCops = [];
  world.over = null;
  world.damageFlash = 0;
}

/** One fixed step. Returns the events this step produced (sounds, screens). */
export function stepWorld(world, input, dt) {
  world.events = [];
  if (world.over) return world.events;
  world.time += dt;
  const player = world.player;
  const actions = input.takeActions();
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  world.damageFlash = Math.max(0, world.damageFlash - dt * 1.4);

  // --- Player -------------------------------------------------------------
  if (player.car) {
    const drive = input.driveAxis();
    const result = updatePlayerCar(player.car, drive, dt, world.city);
    if (result.hitWall && Math.abs(player.car.speed) > 120) {
      world.camera.shake = Math.max(world.camera.shake, 4);
      if (world.audio) world.audio.crash();
    }
    hitPedByCar(world, player.car);
    if (actions & ACTION_ENTER_CAR) exitCar(world);
  } else {
    const move = input.moveAxis();
    const len = Math.hypot(move.x, move.y);
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (len > 0) {
      player.angle = Math.atan2(move.y, move.x);
      const nx = player.x + (move.x / len) * speed * dt;
      const ny = player.y + (move.y / len) * speed * dt;
      const resolved = resolveBuildingCollision(world.city, nx, ny, PLAYER.radius);
      player.x = Math.max(WATER_W + 12, Math.min(WORLD.width - 20, resolved.x));
      player.y = Math.max(20, Math.min(WORLD.height - 20, resolved.y));
    }
    if (actions & ACTION_ENTER_CAR) enterCar(world);
    if (actions & ACTION_PUNCH) punch(world);
    if (actions & ACTION_RELOAD && player.ammo < 12 && player.reserve > 0) {
      const need = 12 - player.ammo;
      const take = Math.min(need, player.reserve);
      player.ammo += take;
      player.reserve -= take;
      if (world.audio) world.audio.click();
    }
    const mouse = input.mouse();
    if (mouse.down && player.fireCooldown <= 0) {
      const worldMouse = screenToWorld(world, mouse.x, mouse.y);
      const angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);
      if (shoot(world, player.x, player.y, angle, 'player')) {
        player.fireCooldown = 0.22;
        player.angle = angle;
        if (world.audio) world.audio.shoot();
        // A gunshot scares nearby pedestrians and draws the law — but one
        // shot is one crime, not one per bullet: the heat gate handles that.
        for (const ped of world.peds) {
          if (Math.hypot(ped.x - player.x, ped.y - player.y) < 320) ped.scared = 2;
        }
        if (world.police.heat > 6) addWanted(world.police, 1, 'fired a weapon');
      } else if (world.audio && player.ammo === 0) {
        world.audio.click();
      }
    }
    if (actions & ACTION_INTERACT) {
      const result = tryInteract(world.missions, world, world.time);
      if (result === 'missionDone') {
        world.events.push({ type: 'missionDone' });
        onMissionStart(world.missions, world);
        if (world.audio) world.audio.jingle();
      } else if (result) {
        if (world.audio) world.audio.pickup();
      }
    }
  }

  // --- Missions -------------------------------------------------------------
  const missionEvents = updateMissions(world.missions, dt, world, world.time);
  for (const event of missionEvents) {
    if (event.type === 'missionDone') {
      world.events.push(event);
      world.stats.missionsDone += 1;
      onMissionStart(world.missions, world);
      if (world.audio) world.audio.jingle();
    } else if (event.type === 'missionFailed') {
      const mission = currentMission(world.missions);
      if (mission) {
        world.missions.step = 0;
        world.missions.timeLeft = mission.timeLimit ?? 0;
        world.missions.banner = 'Job failed — try again';
        world.missions.bannerUntil = world.time + 3;
        world.events.push(event);
      }
    } else {
      world.events.push(event);
    }
  }

  // --- Traffic, pedestrians, police -----------------------------------------
  for (const car of [...world.cars]) {
    if (car.kind === 'traffic' || car.kind === 'parked') {
      if (car.kind === 'traffic') updateTrafficCar(car, world.rng, dt, world.city, world.cars);
      if (car.health <= 0 && car.kind === 'traffic') {
        car.kind = 'parked';
        car.speed = 0;
        car.targetSpeed = 0;
        const replacement = spawnOneTrafficCar(world, world.rng);
        if (replacement) world.cars.push(replacement);
      }
    }
  }
  collideCars(world.cars, (x, y, impact) => {
    if (impact > 160) {
      addParticle(world, x, y, 'spark', 0.3);
      if (world.audio) world.audio.crash();
    }
  });

  const danger = player.car
    ? { x: player.car.x, y: player.car.y, radius: 90 }
    : null;
  for (const ped of world.peds) {
    if (ped.kind === 'cop') {
      updateFootCop(ped, dt, world.city, player.car ?? player, world.onArrest);
      // Armed cops open fire at wanted 3+ when the player is in range.
      if (world.police.level >= 3 && ped.state === 'chase' && !player.car) {
        const d = Math.hypot(ped.x - player.x, ped.y - player.y);
        ped.shootTimer = (ped.shootTimer ?? 1) - dt;
        if (d < 380 && ped.shootTimer <= 0) {
          ped.shootTimer = 1.4;
          const angle = Math.atan2(player.y - ped.y, player.x - ped.x);
          shoot(world, ped.x, ped.y, angle, 'cop');
          if (world.audio) world.audio.shoot();
        }
      }
    } else {
      updatePed(ped, world.rng, dt, world.city, danger);
    }
  }
  updatePolice(world.police, dt, world, world.rng);

  // --- Bullets, pickups, particles -------------------------------------------
  updateBullets(world, dt);
  updatePickups(world, dt);
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  // A smoking wreck keeps smoking.
  for (const car of world.cars) {
    if (car.health < 45 && car.health > 0 && world.rng.chance(0.1)) {
      addParticle(world, car.x, car.y, 'smoke', 0.7);
    }
  }

  // --- Ambient pickups --------------------------------------------------------
  world.pickupTimer -= dt;
  if (world.pickupTimer <= 0) {
    world.pickupTimer = 18;
    if (world.combat.pickups.length < 4) {
      const p = roadSpawnNear(world.city, world.rng, player.x, player.y);
      spawnPickup(world.combat, world.rng.pick(['cash', 'cash', 'health', 'ammo']), p.x, p.y);
    }
  }

  // --- Camera -----------------------------------------------------------------
  const focus = player.car ?? player;
  const viewW = world.viewW;
  const viewH = world.viewH;
  const targetX = Math.max(0, Math.min(WORLD.width - viewW, focus.x - viewW / 2));
  const targetY = Math.max(0, Math.min(WORLD.height - viewH, focus.y - viewH / 2));
  world.camera.x += (targetX - world.camera.x) * Math.min(1, 8 * dt);
  world.camera.y += (targetY - world.camera.y) * Math.min(1, 8 * dt);
  world.camera.shake = Math.max(0, world.camera.shake - dt * 22);

  return world.events;
}

/** Screen pixel -> world coordinate, using the camera (for aiming). */
export function screenToWorld(world, sx, sy) {
  const shakeX = world.camera.shake > 0 ? (Math.random() - 0.5) * world.camera.shake : 0;
  const shakeY = world.camera.shake > 0 ? (Math.random() - 0.5) * world.camera.shake : 0;
  return { x: world.camera.x + sx + shakeX, y: world.camera.y + sy + shakeY };
}

export { currentStep };
