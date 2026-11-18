// Screenshot scenes for ?shot=city|drive|mission|chase (with &seed=N). Each one
// rebuilds the same world from a fixed seed, puts the player in a real situation
// and plays the real rules forward for a couple of seconds, so the frame is what
// a short game really looks like — never staged art.
import { createCar } from './vehicles.js';
import { resetWorld, stepWorld } from './world.js';

const FAKE_INPUT = {
  takeActions: () => 0,
  moveAxis: () => ({ x: 0, y: 0, run: false }),
  driveAxis: () => ({ throttle: 1, steer: 0, brake: false }),
  mouse: () => ({ x: 0, y: 0, down: false }),
};

function stepFor(world, seconds, drive) {
  const input = drive ? FAKE_INPUT : { ...FAKE_INPUT, driveAxis: () => ({ throttle: 0, steer: 0, brake: false }) };
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, input, 1 / 60);
  }
}

function putPlayerInCar(world, x, y, angle, speed) {
  const car = createCar(x, y, angle, '#d94f3d', 'player');
  car.speed = speed;
  world.cars.push(car);
  world.player.car = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  // Clear the road ahead so the frame shows the chase, not a traffic jam.
  // Traffic cruises ~230 px/s and closes head-on at ~750 px/s, so a 1200 px
  // clearing stays clear for the shot.
  clearTrafficNear(world, x, y, 1200);
  return car;
}

/** Remove traffic + parked cars near (x, y) — the staged car needs a clean stretch. */
function clearTrafficNear(world, x, y, radius) {
  world.cars = world.cars.filter(
    (car) => (car.kind !== 'traffic' && car.kind !== 'parked') || Math.hypot(car.x - x, car.y - y) > radius,
  );
}

function addPoliceBehind(world, x, y, angle, count, gap) {
  for (let i = 0; i < count; i += 1) {
    const back = gap * (i + 1);
    const car = createCar(x - Math.cos(angle) * back, y - Math.sin(angle) * back + (i % 2 === 0 ? 40 : -40), angle, '#e8e8e8', 'police');
    car.speed = 420;
    car.targetSpeed = 540;
    world.cars.push(car);
    world.police.cars.push(car);
  }
}

/**
 * Stage `world` into the named scene and return the screen to draw over it.
 * The world must already exist; this resets it to seed 7 first.
 */
export function stageShot(name, world) {
  resetWorld(world, 7);
  const player = world.player;

  if (name === 'drive') {
    // On the avenue in a stolen sedan, two ABPD units closing in.
    putPlayerInCar(world, 1000, 640, 0, 460);
    world.police.level = 2;
    addPoliceBehind(world, 1000, 640, 0, 2, 300);
    stepFor(world, 1.5, true);
    clearBanner(world);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Job two, the handoff itself: on foot at Sunset Pier, the package waiting
    // on the dock, the bay behind. A mission beat, not another car chase.
    world.missions.index = 1;
    world.missions.step = 1;
    world.missions.timeLeft = 64;
    world.missions.packageHeld = false;
    world.missions.banner = '';
    world.missions.bannerUntil = 0;
    world.missions.dialogue = [{ text: 'Mara: "The package is on the pier, Rook. Grab it — and make it quick."', until: 999 }];
    // On the sand right beside the marker ring, facing the pier — the player
    // and the objective read as one beat, with the beach still in view.
    player.x = 175;
    player.y = 1960;
    player.angle = Math.PI; // facing the pier and the bay
    clearTrafficNear(world, 175, 1960, 300);
    stepFor(world, 2.5, false);
    clearBanner(world);
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Four stars, two units closing in, the sedan smoking down the east avenue.
    putPlayerInCar(world, 1800, 1440, 0, 520);
    world.player.car.health = 38;
    world.police.level = 4;
    addPoliceBehind(world, 1800, 1440, 0, 2, 400);
    stepFor(world, 0.8, true);
    clearBanner(world);
    return { screen: 'play' };
  }

  // Default: 'city' — on foot near Mara's Garage at rush hour, first job on the board.
  player.x = 760;
  player.y = 660;
  player.angle = Math.PI / 2;
  world.missions.index = 0;
  world.missions.step = 0;
  world.missions.timeLeft = 0;
  world.missions.banner = '';
  world.missions.bannerUntil = 0;
  world.missions.dialogue = [{ text: 'Mara: "Borrow any car on the street — and bring it to my garage."', until: 999 }];
  stepFor(world, 3, false);
  clearBanner(world);
  return { screen: 'play' };
}

/** The mission banner belongs to live play, not to a still frame. */
function clearBanner(world) {
  world.missions.banner = '';
  world.missions.bannerUntil = 0;
}
