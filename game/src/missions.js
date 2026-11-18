// The story: four jobs in order, each a list of steps. A step completes when the
// player does what it says (reach a marker, press E, steal a car, lose the heat).
// Missions hand the game dialogue lines, the current objective text, the marker
// position for the HUD/minimap, and rewards on completion.
import { LANDMARKS, MISSIONS } from './config.js';

export function createMissions() {
  return {
    index: 0, // which mission is active
    step: 0,
    done: [], // completed mission ids
    timeLeft: 0,
    dialogue: [], // {text, until} lines shown as subtitles
    banner: '', // big centre text on mission start / completion
    bannerUntil: 0,
    packageHeld: false,
    cashHeld: false,
    finishedStory: false,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] ?? null;
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.step] ?? null;
}

export function missionMarker(missions) {
  const step = currentStep(missions);
  if (!step) return null;
  if (step.kind === 'goto' || step.kind === 'interact') return { x: step.x, y: step.y };
  return null;
}

function say(missions, text, seconds, now) {
  missions.dialogue.push({ text, until: now + seconds });
  if (missions.dialogue.length > 3) missions.dialogue.shift();
}

function startMission(missions, now) {
  const mission = currentMission(missions);
  if (!mission) return;
  missions.step = 0;
  missions.timeLeft = mission.timeLimit ?? 0;
  missions.banner = mission.title;
  missions.bannerUntil = now + 3;
  say(missions, mission.briefing, 7, now);
}

export function startStory(missions, now) {
  missions.index = 0;
  missions.done = [];
  missions.finishedStory = false;
  startMission(missions, now);
}

/** Resume a saved game on mission `index` (re-arms its timer and briefing). */
export function resumeMission(missions, index, now) {
  missions.index = Math.max(0, Math.min(MISSIONS.length - 1, index));
  missions.finishedStory = missions.index >= MISSIONS.length;
  missions.packageHeld = false;
  missions.cashHeld = false;
  startMission(missions, now);
}

/** Advance the story clock; returns events the main loop acts on. */
export function updateMissions(missions, dt, world, now) {
  const events = [];
  const mission = currentMission(missions);
  if (!mission) return events;
  if (mission.timeLimit) {
    missions.timeLeft -= dt;
    if (missions.timeLeft <= 0) {
      events.push({ type: 'missionFailed', reason: 'Time ran out' });
      return events;
    }
  }
  const step = currentStep(missions);
  if (!step) return events;
  const player = world.player;
  const pos = player.car ?? player;

  if (step.kind === 'enterCar' && player.car) {
    events.push({ type: 'stepDone' });
  } else if (step.kind === 'goto') {
    const d = Math.hypot(pos.x - step.x, pos.y - step.y);
    if (d < step.radius) events.push({ type: 'stepDone' });
  } else if (step.kind === 'loseWanted') {
    if (world.police.level === 0) events.push({ type: 'stepDone' });
  }
  // 'interact' steps complete from main.js when the player presses E in range.

  for (const event of events) {
    if (event.type !== 'stepDone') continue;
    missions.step += 1;
    if (missions.step >= mission.steps.length) {
      // Mission complete: pay out, advance the story.
      const reward = mission.reward;
      player.money += reward;
      missions.done.push(mission.id);
      missions.banner = `Job done — +$${reward}`;
      missions.bannerUntil = now + 3;
      say(missions, 'Mara: "Clean work, Rook. The bay is starting to notice you."', 5, now);
      events.push({ type: 'missionDone', mission, reward });
      missions.index += 1;
      if (missions.index >= MISSIONS.length) {
        missions.finishedStory = true;
        missions.banner = 'You own Azure Bay';
        missions.bannerUntil = now + 5;
        say(missions, 'Mara: "That\'s the whole bay, Rook. From here on, it\'s all free roam."', 7, now);
      } else {
        startMission(missions, now);
      }
    }
  }
  return events;
}

/** Called when the player presses E; completes an interact step in range. */
export function tryInteract(missions, world, now) {
  const step = currentStep(missions);
  if (!step || step.kind !== 'interact') return false;
  const player = world.player;
  const pos = player.car ?? player;
  const d = Math.hypot(pos.x - step.x, pos.y - step.y);
  if (d > step.radius) return false;
  const mission = currentMission(missions);
  if (mission.id === 'pickup') {
    missions.packageHeld = true;
    say(missions, 'You grab the package. It\'s heavier than it looks.', 3, now);
  } else if (mission.id === 'job') {
    missions.cashHeld = true;
    say(missions, 'You grab the cash — and every alarm in the bay goes off.', 3, now);
    if (world.onJobCash) world.onJobCash();
  }
  missions.step += 1;
  if (missions.step >= mission.steps.length) {
    const reward = mission.reward;
    world.player.money += reward;
    missions.done.push(mission.id);
    missions.banner = `Job done — +$${reward}`;
    missions.bannerUntil = now + 3;
    missions.index += 1;
    if (missions.index >= MISSIONS.length) {
      missions.finishedStory = true;
      missions.banner = 'You own Azure Bay';
      missions.bannerUntil = now + 5;
    } else {
      startMission(missions, now);
    }
    return 'missionDone';
  }
  return true;
}

/** Mission-specific setup the moment a mission starts (e.g. the heat job). */
export function onMissionStart(missions, world) {
  const mission = currentMission(missions);
  if (!mission) return;
  if (mission.id === 'heat' && world.police.level < 3) {
    world.police.level = 3;
    world.police.heat = 0;
    world.police.quietTime = 0;
  }
  if (mission.id === 'job') {
    // The bank van waits behind the bank; taking the cash is the trigger.
    world.bankVanReady = true;
  }
}

export { LANDMARKS };
