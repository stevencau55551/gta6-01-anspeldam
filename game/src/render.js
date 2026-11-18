// All drawing: the city, its cars and people, the particles, and the minimap.
// Canvas 2D only, no images — every visual is drawn from the world state.
import { BEACH_W, PALETTE, ROAD_W, ROAD_X, ROAD_Y, WATER_W, WORLD } from './config.js';
import { missionMarker } from './missions.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function inView(cam, viewW, viewH, x, y, w, h, margin) {
  return x + w + margin > cam.x && x - margin < cam.x + viewW && y + h + margin > cam.y && y - margin < cam.y + viewH;
}

export function drawWorld(ctx, world, viewW, viewH) {
  const cam = world.camera;
  const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  ctx.save();
  ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY));

  const vx0 = cam.x - 40;
  const vy0 = cam.y - 40;
  const vx1 = cam.x + viewW + 40;
  const vy1 = cam.y + viewH + 40;

  // --- Ground ---------------------------------------------------------------
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // The bay (west edge) and the beach.
  ctx.fillStyle = PALETTE.water;
  const wx0 = Math.max(vx0, 0);
  ctx.fillRect(wx0, vy0, Math.max(0, WATER_W - wx0), vy1 - vy0);
  ctx.fillStyle = PALETTE.sand;
  const sx0 = Math.max(vx0, WATER_W);
  ctx.fillRect(sx0, vy0, Math.max(0, BEACH_W - sx0), vy1 - vy0);
  // Water shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = 60; y < WORLD.height; y += 170) {
    if (y < vy0 || y > vy1) continue;
    ctx.beginPath();
    ctx.moveTo(8, y + Math.sin(world.time * 0.7 + y) * 4);
    ctx.lineTo(58, y + Math.cos(world.time * 0.5 + y) * 4);
    ctx.stroke();
  }

  // --- Parks, plazas ----------------------------------------------------------
  for (const park of world.city.parks) {
    if (!inView(cam, viewW, viewH, park.x, park.y, park.w, park.h, 0)) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(park.x, park.y, park.w, 10);
  }
  for (const plaza of world.city.plazas) {
    if (!inView(cam, viewW, viewH, plaza.x, plaza.y, plaza.w, plaza.h, 0)) continue;
    ctx.fillStyle = PALETTE.plaza;
    ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    ctx.fillStyle = '#6fb3d9';
    ctx.beginPath();
    ctx.arc(plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Roads ------------------------------------------------------------------
  for (const rx of ROAD_X) {
    if (rx < vx0 - ROAD_W || rx > vx1 + ROAD_W) continue;
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(rx - ROAD_W / 2 - 12, vy0, ROAD_W + 24, vy1 - vy0);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(rx - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
    ctx.fillStyle = PALETTE.lane;
    for (let y = Math.floor(vy0 / 70) * 70; y < vy1; y += 70) {
      ctx.fillRect(rx - 2, y, 4, 34);
    }
  }
  for (const ry of ROAD_Y) {
    if (ry < vy0 - ROAD_W || ry > vy1 + ROAD_W) continue;
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(vx0, ry - ROAD_W / 2 - 12, vx1 - vx0, ROAD_W + 24);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(vx0, ry - ROAD_W / 2, vx1 - vx0, ROAD_W);
    ctx.fillStyle = PALETTE.lane;
    for (let x = Math.floor(vx0 / 70) * 70; x < vx1; x += 70) {
      ctx.fillRect(x, ry - 2, 34, 4);
    }
  }

  // --- Palms ------------------------------------------------------------------
  for (const palm of world.city.palms) {
    if (palm.x < vx0 || palm.x > vx1 || palm.y < vy0 || palm.y > vy1) continue;
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 12);
    ctx.stroke();
    ctx.fillStyle = '#3f8f3a';
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 9, palm.y - 14 + Math.sin(a) * 7, 10, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Buildings (shadow, south wall, roof, rooftop details) ------------------
  for (const b of world.city.buildings) {
    if (!inView(cam, viewW, viewH, b.x, b.y, b.w, b.h, 80)) continue;
    const lift = b.height * 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + lift * 0.5, b.y + lift * 0.6, b.w, b.h);
    ctx.fillStyle = shade(b.wall, -28);
    ctx.fillRect(b.x, b.y + b.h, b.w, lift * 0.55);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Rooftop details: AC units and a skylight.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const units = Math.max(1, Math.floor((b.w * b.h) / 9000));
    for (let u = 0; u < units; u += 1) {
      const ux = b.x + 10 + ((u * 37) % Math.max(20, b.w - 30));
      const uy = b.y + 10 + ((u * 53) % Math.max(20, b.h - 30));
      ctx.fillRect(ux, uy, 16, 12);
    }
  }

  // --- Mission marker -----------------------------------------------------------
  const marker = missionMarker(world.missions);
  if (marker) {
    const pulse = 1 + Math.sin(world.time * 4) * 0.12;
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,74,0.18)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // A light beam so the target is visible from across the city.
    const beam = ctx.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
    beam.addColorStop(0, 'rgba(255,217,74,0)');
    beam.addColorStop(1, 'rgba(255,217,74,0.35)');
    ctx.fillStyle = beam;
    ctx.fillRect(marker.x - 8, marker.y - 260, 16, 260);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 52 - Math.sin(world.time * 4) * 6);
    ctx.lineTo(marker.x - 10, marker.y - 34 - Math.sin(world.time * 4) * 6);
    ctx.lineTo(marker.x + 10, marker.y - 34 - Math.sin(world.time * 4) * 6);
    ctx.closePath();
    ctx.fill();
  }

  // --- Pickups ------------------------------------------------------------------
  for (const p of world.combat.pickups) {
    const bob = Math.sin(p.bob) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if (p.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#e33f2f';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else if (p.kind === 'ammo') {
      ctx.fillStyle = '#f5d76e';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#3d3a44';
      ctx.fillRect(-7, -4, 4, 8);
      ctx.fillRect(0, -4, 4, 8);
      ctx.fillRect(7, -4, 3, 8);
    } else {
      ctx.fillStyle = '#37b24d';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    }
    ctx.restore();
  }

  // --- Cars -----------------------------------------------------------------------
  for (const car of world.cars) {
    if (!inView(cam, viewW, viewH, car.x, car.y, 70, 70, 40)) continue;
    drawCar(ctx, car, world.time);
  }

  // --- People ---------------------------------------------------------------------
  for (const ped of world.peds) {
    if (ped.x < vx0 || ped.x > vx1 || ped.y < vy0 || ped.y > vy1) continue;
    if (ped.state === 'down') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 16, 8, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'cop') {
      ctx.fillStyle = '#1d2f4a';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9c25a';
      ctx.fillRect(ped.x - 8, ped.y - 3, 16, 3);
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Player on foot ---------------------------------------------------------------
  const player = world.player;
  if (!player.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(player.x + 2, player.y + 4, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14a0a0';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5 - 3, 7, Math.PI, 0);
    ctx.fill();
    // A white ring so the player never gets lost in a crowd.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Bullets ------------------------------------------------------------------------
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 3;
  for (const b of world.combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // --- Particles ------------------------------------------------------------------------
  for (const p of world.particles) {
    const t = p.life / p.maxLife;
    if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(80,80,80,${0.45 * t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 + (1 - t) * 16, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.fillStyle = `rgba(255,180,60,${t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * t + 1, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'stars') {
      ctx.fillStyle = `rgba(255,220,80,${t})`;
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + p.life;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === 'flash') {
      ctx.fillStyle = `rgba(255,240,150,${t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * t + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 32, 20, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-24, -19, 12, 6);
  ctx.fillRect(-24, 13, 12, 6);
  ctx.fillRect(12, -19, 12, 6);
  ctx.fillRect(12, 13, 12, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -31, -17, 62, 34, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, -31, -17, 62, 34, 9);
  ctx.stroke();
  // Windshield + roof.
  ctx.fillStyle = 'rgba(180,220,235,0.9)';
  ctx.fillRect(-9, -14, 12, 28);
  ctx.fillStyle = shade(car.color, -18);
  ctx.fillRect(6, -13, 15, 26);
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.beginPath();
  ctx.arc(30, -11, 3, 0, Math.PI * 2);
  ctx.arc(30, 11, 3, 0, Math.PI * 2);
  ctx.fill();
  if (car.kind === 'police') {
    // Black doors + flashing light bar.
    ctx.fillStyle = '#1d2f4a';
    ctx.fillRect(-6, -17, 14, 5);
    ctx.fillRect(-6, 12, 14, 5);
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2f2f' : '#2f6bff';
    ctx.fillRect(-4, -17, 9, 6);
    ctx.fillStyle = flash ? '#2f6bff' : '#ff2f2f';
    ctx.fillRect(-4, 11, 9, 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ABPD', 0, 0);
  }
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(60,60,60,0.8)';
    ctx.beginPath();
    ctx.arc(-18, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Darken (negative) or lighten (positive) a #rrggbb colour. */
export function shade(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

// --- Minimap -------------------------------------------------------------------------

export function drawMinimap(ctx, world, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();
  ctx.fillStyle = 'rgba(16,20,24,0.88)';
  ctx.fillRect(x, y, w, h);
  // Water + beach.
  ctx.fillStyle = '#1d7ea3';
  ctx.fillRect(x, y, WATER_W * sx, h);
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(x + WATER_W * sx, y, (BEACH_W - WATER_W) * sx, h);
  // Roads.
  ctx.strokeStyle = '#a8a8b8';
  ctx.lineWidth = 2.5;
  for (const rx of ROAD_X) {
    ctx.beginPath();
    ctx.moveTo(x + rx * sx, y);
    ctx.lineTo(x + rx * sx, y + h);
    ctx.stroke();
  }
  for (const ry of ROAD_Y) {
    ctx.beginPath();
    ctx.moveTo(x, y + ry * sy);
    ctx.lineTo(x + w, y + ry * sy);
    ctx.stroke();
  }
  // Buildings as dots.
  ctx.fillStyle = '#6f6f80';
  for (const b of world.city.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  // Police blips.
  const flash = Math.floor(world.time * 3) % 2 === 0;
  ctx.fillStyle = flash ? '#ff4040' : '#4090ff';
  for (const car of world.police.cars) {
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker.
  const marker = missionMarker(world.missions);
  if (marker) {
    const pulse = 3 + Math.sin(world.time * 5) * 1.2;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Player arrow.
  const player = world.player;
  const pos = player.car ?? player;
  ctx.save();
  ctx.translate(x + pos.x * sx, y + pos.y * sy);
  ctx.rotate(player.car ? player.car.angle : player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Frame + north label.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('N', x + 6, y + 5);
}
