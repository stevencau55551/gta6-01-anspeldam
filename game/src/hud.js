// HUD, menus and overlays, all drawn on the same canvas: health, cash, ammo,
// wanted stars, the objective, dialogue subtitles, the big banners, and the
// title / pause / busted / wasted screens.
import { CAR, MISSIONS } from './config.js';
import { currentMission, currentStep } from './missions.js';
import { drawMinimap } from './render.js';

function pill(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12,14,18,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.arcTo(x + w, y, x + w, y + h, 8);
  ctx.arcTo(x + w, y + h, x, y + h, 8);
  ctx.arcTo(x, y + h, x, y, 8);
  ctx.arcTo(x, y, x + w, y, 8);
  ctx.closePath();
  ctx.fill();
}

export function drawHUD(ctx, world, viewW, viewH) {
  const player = world.player;
  const now = world.time;

  // --- Top left: cash, health, ammo ----------------------------------------------
  pill(ctx, 12, 12, 210, 86, 0.72);
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`$${player.money.toLocaleString('en-US')}`, 24, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`AMMO  ${player.ammo} / ${player.reserve}`, 24, 52);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(24, 72, 186, 10);
  const hpRatio = Math.max(0, player.hp / 100);
  ctx.fillStyle = hpRatio > 0.5 ? '#37d67a' : hpRatio > 0.25 ? '#f5b93c' : '#e33f2f';
  ctx.fillRect(24, 72, 186 * hpRatio, 10);

  // --- Top right: minimap + wanted stars -------------------------------------------
  drawMinimap(ctx, world, viewW - 222, 12, 210, 156);
  const stars = world.police.level;
  pill(ctx, viewW - 222, 172, 210, 34, 0.72);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 5; i += 1) {
    const cx = viewW - 200 + i * 34;
    const cy = 176;
    ctx.font = '26px sans-serif';
    ctx.fillStyle = i < stars ? '#ffd94a' : 'rgba(255,255,255,0.4)';
    ctx.fillText('★', cx, cy);
    if (i < stars) {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeText('★', cx, cy);
    }
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ABPD ON YOUR TAIL', viewW - 117, 212);
  }

  // --- Objective banner --------------------------------------------------------------
  const mission = currentMission(world.missions);
  const step = currentStep(world.missions);
  if (mission && step && !world.missions.finishedStory) {
    const text = `${mission.title} — ${step.text}`;
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(text).width + 28;
    pill(ctx, (viewW - w) / 2, 12, w, 32, 0.72);
    ctx.fillStyle = '#ffd94a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, viewW / 2, 29);
    if (mission.timeLimit) {
      const left = Math.max(0, Math.ceil(world.missions.timeLeft));
      ctx.fillStyle = left <= 20 ? '#ff6b5e' : '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, viewW / 2, 56);
    }
  } else if (world.missions.finishedStory) {
    ctx.font = 'bold 15px sans-serif';
    const text = 'STORY COMPLETE — free roam. Azure Bay is yours.';
    const w = ctx.measureText(text).width + 28;
    pill(ctx, (viewW - w) / 2, 12, w, 32, 0.72);
    ctx.fillStyle = '#37d67a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, viewW / 2, 29);
  }

  // --- Big centre banner (mission start / complete) -------------------------------------
  if (now < world.missions.bannerUntil) {
    const fade = Math.min(1, (world.missions.bannerUntil - now) * 2);
    ctx.globalAlpha = fade;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(world.missions.banner, viewW / 2 + 3, viewH / 2 - 60 + 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(world.missions.banner, viewW / 2, viewH / 2 - 60);
    ctx.globalAlpha = 1;
  }

  // --- Dialogue subtitles ------------------------------------------------------------------
  const lines = world.missions.dialogue.filter((d) => now < d.until);
  if (lines.length > 0) {
    const line = lines[lines.length - 1];
    ctx.font = '16px sans-serif';
    const w = Math.min(viewW - 120, ctx.measureText(line.text).width + 36);
    pill(ctx, (viewW - w) / 2, viewH - 128, w, 44, 0.78);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line.text, viewW / 2, viewH - 106);
  }

  // --- Bottom left: controls hint ------------------------------------------------------------
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const hint = player.car
    ? 'W/S drive • A/D steer • E exit car • Space handbrake • Esc pause'
    : 'WASD move • Shift run • E enter car / interact • F punch • Click shoot • R reload • Esc pause';
  ctx.fillText(hint, 14, viewH - 12);

  // --- Bottom right: speed / car health ---------------------------------------------------------
  if (player.car) {
    const mph = Math.round(Math.abs(player.car.speed) * 0.12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${mph}`, viewW - 56, viewH - 40);
    ctx.font = '12px sans-serif';
    ctx.fillText('MPH', viewW - 18, viewH - 40);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(viewW - 214, viewH - 30, 200, 8);
    ctx.fillStyle = player.car.health > 45 ? '#37d67a' : '#e33f2f';
    ctx.fillRect(viewW - 214, viewH - 30, 200 * Math.max(0, player.car.health / 100), 8);
  }

  // --- Damage flash ------------------------------------------------------------------------------
  if (world.damageFlash > 0) {
    const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.3, viewW / 2, viewH / 2, viewH * 0.75);
    grad.addColorStop(0, 'rgba(220,40,30,0)');
    grad.addColorStop(1, `rgba(220,40,30,${world.damageFlash * 0.55})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

export function drawTitle(ctx, world, viewW, viewH, saveExists) {
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('AZURE BAY', viewW / 2, viewH / 2 - 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime story on the sun coast', viewW / 2, viewH / 2 - 96);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '16px sans-serif';
  const lines = [
    'Steal cars. Outrun the ABPD. Run four jobs for Mara and take the bay.',
    'WASD move / drive • E enter car • F punch • Click shoot • R reload • Shift run • Esc pause • M mute',
    'Traffic, pedestrians, police chases, missions, combat, saves — all in one city.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, viewW / 2, viewH / 2 - 40 + i * 26);
  });
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(saveExists ? 'ENTER — New game      C — Continue' : 'Press ENTER to start', viewW / 2, viewH / 2 + 70);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('Original city, characters and story. No Rockstar names, maps or assets.', viewW / 2, viewH - 28);
}

export function drawPause(ctx, viewW, viewH) {
  ctx.fillStyle = 'rgba(8,12,20,0.66)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 60);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Esc / Enter — resume      Q — save & quit to title      R — restart the story', viewW / 2, viewH / 2 + 10);
}

export function drawOver(ctx, world, viewW, viewH) {
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const busted = world.over === 'busted';
  ctx.fillStyle = busted ? '#ffd94a' : '#ff6b5e';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', viewW / 2, viewH / 2 - 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(
    busted
      ? 'The ABPD hauled you in. You wake up at St. Coral Hospital — the bay forgets, for now.'
      : 'You black out. You wake up at St. Coral Hospital — patched up, poorer, still breathing.',
    viewW / 2,
    viewH / 2 - 10,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '16px sans-serif';
  ctx.fillText(
    `Cash $${world.player.money.toLocaleString('en-US')}  •  Jobs done ${world.missions.done.length} / ${MISSIONS.length}  •  Cars stolen ${world.stats.carsStolen}`,
    viewW / 2,
    viewH / 2 + 30,
  );
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press ENTER to get back on the street', viewW / 2, viewH / 2 + 80);
}

export { CAR };
