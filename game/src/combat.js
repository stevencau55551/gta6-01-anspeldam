// Combat: the player's punch and pistol, enemy bullets from armed cops, and the
// pickups (health, ammo, cash) scattered around the bay.
import { PLAYER } from './config.js';
import { addWanted } from './police.js';
import { knockDown } from './people.js';
import { carRadius } from './vehicles.js';
import { pointInBuilding } from './city.js';

export const BULLET_SPEED = 950;

export function createCombat() {
  return { bullets: [], pickups: [] };
}

export function spawnPickup(combat, kind, x, y) {
  combat.pickups.push({ kind, x, y, bob: Math.random() * Math.PI * 2 });
}

export function shoot(world, x, y, angle, from) {
  const player = world.player;
  if (from === 'player') {
    if (player.ammo <= 0) return false;
    player.ammo -= 1;
    world.stats.shotsFired += 1;
  }
  world.combat.bullets.push({
    x, y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: 0.9,
    damage: from === 'player' ? 34 : 8,
    from,
  });
  addParticle(world, x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, 'flash', 0.08);
  return true;
}

export function punch(world) {
  const player = world.player;
  if (player.punchCooldown > 0) return false;
  player.punchCooldown = 0.45;
  let hit = null;
  let bestD = PLAYER.punchRange;
  for (const person of world.peds) {
    if (person.state === 'down') continue;
    const dx = person.x - player.x;
    const dy = person.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > bestD) continue;
    const angleTo = Math.atan2(dy, dx);
    let diff = angleTo - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PLAYER.punchArc) continue;
    hit = person;
    bestD = d;
  }
  if (!hit) return false;
  const wasCop = knockDown(hit, hit.kind === 'cop' ? 5 : 6);
  hit.x += Math.cos(player.angle) * 18;
  hit.y += Math.sin(player.angle) * 18;
  addParticle(world, hit.x, hit.y, 'stars', 0.4);
  // One assault is one crime: only raise the heat if the last crime was a while ago.
  if (world.police.heat > 6) {
    if (wasCop) addWanted(world.police, 2, 'assaulted an officer');
    else addWanted(world.police, 1, 'assaulted a pedestrian');
  }
  if (world.audio) world.audio.punch();
  return true;
}

export function addParticle(world, x, y, kind, life) {
  world.particles.push({ x, y, kind, life, maxLife: life, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60 });
}

export function updateBullets(world, dt) {
  const bullets = world.combat.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && pointInBuilding(world.city, b.x, b.y)) {
      addParticle(world, b.x, b.y, 'spark', 0.25);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const person of world.peds) {
        if (person.state === 'down') continue;
        if (Math.hypot(person.x - b.x, person.y - b.y) < 16) {
          const wasCop = knockDown(person, person.kind === 'cop' ? 5 : 8);
          if (wasCop) addWanted(world.police, 2, 'shot an officer');
          addParticle(world, person.x, person.y, 'stars', 0.4);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const car of world.cars) {
        if (car === world.player.car) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < carRadius() + 4) {
          car.health -= b.damage;
          if (car.health <= 25 && car.kind === 'police') car.speed = 0;
          addParticle(world, b.x, b.y, 'spark', 0.25);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'cop') {
      const p = world.player;
      if (!p.car && Math.hypot(p.x - b.x, p.y - b.y) < 15) {
        damagePlayer(world, b.damage);
        dead = true;
      } else if (p.car && Math.hypot(p.car.x - b.x, p.car.y - b.y) < carRadius() + 4) {
        p.car.health -= b.damage;
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

/** Damage the player on foot (cars handle their own damage). Sets world.over. */
export function damagePlayer(world, amount) {
  const player = world.player;
  if (player.invuln > 0 || world.over) return;
  player.hp -= amount;
  player.invuln = 0.4;
  world.damageFlash = 0.5;
  if (player.hp <= 0) {
    player.hp = 0;
    world.over = 'wasted';
    if (world.audio) world.audio.busted();
  }
}

export function updatePickups(world, dt) {
  const player = world.player;
  const pos = player.car ?? player;
  const pickups = world.combat.pickups;
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const p = pickups[i];
    p.bob += dt * 3;
    const d = Math.hypot(p.x - pos.x, p.y - pos.y);
    if (d < 30) {
      if (p.kind === 'health') {
        player.hp = Math.min(100, player.hp + 30);
        if (world.audio) world.audio.pickup();
      } else if (p.kind === 'ammo') {
        player.reserve += 24;
        if (world.audio) world.audio.pickup();
      } else if (p.kind === 'cash') {
        const amount = 25 + Math.floor(Math.random() * 55);
        player.money += amount;
        if (world.audio) world.audio.cash();
      }
      pickups.splice(i, 1);
    }
  }
}
