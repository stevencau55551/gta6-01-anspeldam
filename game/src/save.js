// Save / load through localStorage. Only progress numbers are stored — never the
// whole world — so a save is a few hundred bytes and loads instantly.
import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const player = world.player;
    const pos = player.car ?? player;
    const data = {
      version: 1,
      money: player.money,
      hp: player.hp,
      ammo: player.ammo,
      reserve: player.reserve,
      missionIndex: world.missions.index,
      missionsDone: world.missions.done,
      x: pos.x,
      y: pos.y,
      time: world.time,
      stats: world.stats,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    // A save is user-editable text: coerce every field back into range instead
    // of trusting it, so a tampered save degrades to defaults, never to NaN.
    const num = (value, fallback, min, max) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    return {
      version: 1,
      money: num(data.money, 150, 0, 99999999),
      hp: num(data.hp, 100, 25, 100),
      ammo: num(data.ammo, 12, 0, 999),
      reserve: num(data.reserve, 48, 0, 999),
      missionIndex: num(data.missionIndex, 0, 0, 3),
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone.filter((id) => typeof id === 'string') : [],
      x: num(data.x, 700, 80, 3180),
      y: num(data.y, 700, 20, 2380),
      time: num(data.time, 0, 0, 1e9),
      stats: data.stats && typeof data.stats === 'object' ? data.stats : undefined,
    };
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
