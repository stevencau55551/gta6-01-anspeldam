// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused, over. ?seed=N fixes the city. ?shot=city|drive|mission|chase (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createWorld, resetWorld, respawnPlayer, stepWorld } from './world.js';
import { drawHUD, drawOver, drawPause, drawTitle } from './hud.js';
import { drawWorld } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, loadGame, saveGame } from './save.js';
import { resumeMission, startStory } from './missions.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 30;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(seed);
world.audio = audio;
void createRandom;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  world.viewW = canvas.width;
  world.viewH = canvas.height;
}
window.addEventListener('resize', resize);
resize();

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  // Shots are silent stills: no audio, so no AudioContext warnings in headless runs.
  world.audio = null;
  const scene = stageShot(name, world);
  resize();
  let painted = 0;
  function paint() {
    drawWorld(ctx, world, world.viewW, world.viewH);
    if (scene.screen === 'play') drawHUD(ctx, world, world.viewW, world.viewH);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let save = loadGame();
  let autosaveTimer = AUTOSAVE_SECONDS;
  let accumulator = 0;
  let last = performance.now();

  function startNewGame() {
    resetWorld(world, Math.floor(Math.random() * 4294967296));
    world.audio = audio;
    startStory(world.missions, 0);
    clearSave();
    save = null;
    screen = 'play';
    audio.ensure();
    audio.startMusic();
    announce('Playing Azure Bay. First job: Borrowed Wheels.');
  }

  function continueGame() {
    const data = loadGame();
    if (!data) {
      startNewGame();
      return;
    }
    resetWorld(world, Math.floor(Math.random() * 4294967296));
    world.audio = audio;
    const player = world.player;
    player.money = data.money;
    player.hp = Math.max(25, data.hp);
    player.ammo = data.ammo;
    player.reserve = data.reserve;
    player.x = data.x;
    player.y = data.y;
    world.missions.done = data.missionsDone ?? [];
    world.stats = data.stats ?? world.stats;
    resumeMission(world.missions, data.missionIndex, 0);
    screen = 'play';
    audio.ensure();
    audio.startMusic();
    announce('Welcome back to Azure Bay.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }

    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) startNewGame();
      // The title idles on the live city: traffic and pedestrians keep moving.
      while (accumulator >= STEP) {
        stepWorld(world, { takeActions: () => 0, moveAxis: () => ({ x: 0, y: 0, run: false }), driveAxis: () => ({ throttle: 0, steer: 0, brake: false }), mouse: () => ({ x: 0, y: 0, down: false }) }, STEP);
        accumulator -= STEP;
      }
      drawWorld(ctx, world, world.viewW, world.viewH);
      drawTitle(ctx, world, world.viewW, world.viewH, save !== null);
      return;
    }

    if (screen === 'pause') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = 'play';
        announce('Playing.');
      }
      drawWorld(ctx, world, world.viewW, world.viewH);
      drawHUD(ctx, world, world.viewW, world.viewH);
      drawPause(ctx, world.viewW, world.viewH);
      accumulator = 0;
      return;
    }

    if (screen === 'over') {
      if (actions & ACTION_CONFIRM) {
        respawnPlayer(world);
        screen = 'play';
        announce('Back on the street.');
      }
      drawWorld(ctx, world, world.viewW, world.viewH);
      drawOver(ctx, world, world.viewW, world.viewH);
      accumulator = 0;
      return;
    }

    // screen === 'play'
    if (actions & ACTION_PAUSE) {
      screen = 'pause';
      audio.setEngine(false, 0);
      audio.setSiren(false);
      announce('Paused.');
    }
    while (accumulator >= STEP && screen === 'play') {
      stepWorld(world, input, STEP);
      accumulator -= STEP;
      if (world.over) {
        screen = 'over';
        break;
      }
    }
    if (screen !== 'play') {
      accumulator = 0;
    } else {
      // Engine + siren follow the game state.
      const player = world.player;
      audio.setEngine(!!player.car, player.car ? Math.abs(player.car.speed) / 580 : 0);
      audio.setSiren(world.police.level > 0);
      autosaveTimer -= Math.min(0.25, 1 / 60);
      if (autosaveTimer <= 0) {
        autosaveTimer = AUTOSAVE_SECONDS;
        saveGame(world);
      }
    }
    drawWorld(ctx, world, world.viewW, world.viewH);
    if (screen === 'play') drawHUD(ctx, world, world.viewW, world.viewH);
    else if (screen === 'pause') drawPause(ctx, world.viewW, world.viewH);
    else if (screen === 'over') drawOver(ctx, world, world.viewW, world.viewH);
  }

  // C (continue), Q (quit to title) and R (restart) are plain keys, handled here
  // so the input module stays free of screen logic.
  window.addEventListener('keydown', (event) => {
    if ((event.key === 'c' || event.key === 'C') && screen === 'title' && save) {
      continueGame();
    }
    if (event.key === 'q' || event.key === 'Q') {
      if (screen === 'pause') {
        saveGame(world);
        screen = 'title';
        save = loadGame();
        audio.setEngine(false, 0);
        audio.setSiren(false);
        announce('Saved. Title screen.');
      }
    }
    if (event.key === 'r' || event.key === 'R') {
      if (screen === 'pause') {
        startNewGame();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      audio.setEngine(false, 0);
      audio.setSiren(false);
      announce('Paused.');
    }
  });

  announce('Azure Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
