// Azure Bay — every tunable number, the city layout and the story, in one place.
// Nothing here touches the DOM or the network: pure data the other modules read.
export const STEP = 1 / 60;
export const SAVE_KEY = 'azure-bay-save-v1';

export const WORLD = { width: 3200, height: 2400 };

// Road centre lines. The grid makes the traffic AI trivial: a car always travels
// along one centre line and only turns at a crossing.
export const ROAD_X = [240, 640, 1040, 1440, 1840, 2240, 2640, 3040];
export const ROAD_Y = [240, 640, 1040, 1440, 1840, 2240];
export const ROAD_W = 96;
export const BEACH_W = 150; // x < BEACH_W is sand; x < 70 is the bay itself.
export const WATER_W = 70;

// Sun-soaked palette: warm asphalt, pale sidewalks, pastel towers, turquoise bay.
export const PALETTE = {
  grass: '#7fae5a',
  grassDry: '#a8b565',
  sand: '#e8d39a',
  water: '#2fa8c9',
  waterDeep: '#1d7ea3',
  asphalt: '#3d3a44',
  asphaltDark: '#333038',
  sidewalk: '#c9c2b2',
  lane: '#f5d76e',
  park: '#5d9b4a',
  plaza: '#b7ad97',
};

export const DISTRICTS = [
  { name: 'Marina Beach', x0: 150, y0: 0, x1: 640, y1: 2400, style: 'beach' },
  { name: 'Downtown', x0: 1040, y0: 0, x1: 2240, y1: 1040, style: 'downtown' },
  { name: 'Old Town', x0: 640, y0: 1040, x1: 1840, y1: 1840, style: 'oldtown' },
  { name: 'Industrial', x0: 2640, y0: 0, x1: 3200, y1: 2400, style: 'industrial' },
  { name: 'Southside', x0: 640, y0: 1840, x1: 3200, y1: 2400, style: 'suburb' },
];

// Landmark spots (world coordinates). Missions and the minimap point at these.
export const LANDMARKS = {
  garage: { x: 560, y: 560, label: "Mara's Garage" },
  dock: { x: 130, y: 1960, label: 'Sunset Pier' },
  bank: { x: 1560, y: 560, label: 'Azure National Bank' },
  hideout: { x: 1160, y: 1560, label: 'Hideout' },
  hospital: { x: 2160, y: 2080, label: 'St. Coral Hospital' },
  plaza: { x: 1640, y: 1240, label: 'Coral Plaza' },
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 235,
  runSpeed: 350,
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 46,
  punchArc: 1.1,
};

export const CAR = {
  width: 34,
  length: 62,
  accel: 540,
  brake: 900,
  reverseMax: 230,
  maxSpeed: 580,
  turnRate: 2.7,
  grip: 3.2,
};

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 42;

export const WANTED = {
  decaySeconds: 26, // one star fades after this long with no crime and no cop in sight
  maxPoliceCars: 8,
  chaseSpeed: 540,
  ramDamage: 8,
};

// The story: four jobs, in order. Each step is an objective the player can finish;
// `kind` tells missions.js what to watch for.
export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Borrowed Wheels',
    reward: 200,
    briefing: 'Mara: "Rook, I need wheels and I need them now. Borrow any car on the street — just don\'t let the owner catch you — and bring it to my garage."',
    steps: [
      { kind: 'enterCar', text: 'Get in any car — walk up to one and press E' },
      { kind: 'goto', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, radius: 90, text: "Drive to Mara's Garage" },
    ],
  },
  {
    id: 'pickup',
    title: 'Dockside Pickup',
    reward: 500,
    timeLimit: 110,
    briefing: 'Mara: "A package is waiting at Sunset Pier. Pick it up and bring it back here. The pier crew clocks off soon — make it quick."',
    steps: [
      { kind: 'goto', x: LANDMARKS.dock.x, y: LANDMARKS.dock.y, radius: 80, text: 'Reach Sunset Pier' },
      { kind: 'interact', x: LANDMARKS.dock.x, y: LANDMARKS.dock.y, radius: 70, text: 'Press E to grab the package' },
      { kind: 'goto', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, radius: 90, text: 'Deliver the package to the garage' },
    ],
  },
  {
    id: 'heat',
    title: 'Heat Wave',
    reward: 400,
    timeLimit: 150,
    briefing: 'Mara: "The bay police are all over you after that pier job. Lose them. Break line of sight, keep moving, and don\'t pick up new charges."',
    steps: [
      { kind: 'loseWanted', text: 'Lose the heat — get your wanted level to zero' },
    ],
  },
  {
    id: 'job',
    title: 'The Azure Job',
    reward: 2000,
    timeLimit: 240,
    briefing: 'Mara: "One last job, Rook. The bank van parks behind Azure National at noon. Take the cash, shake the whole department, and bring it to the hideout. Then we own this bay."',
    steps: [
      { kind: 'goto', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 90, text: 'Reach Azure National Bank' },
      { kind: 'interact', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 70, text: 'Press E to grab the cash' },
      { kind: 'goto', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, radius: 90, text: 'Escape to the Hideout — the whole bay is after you' },
    ],
  },
];

export const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93c', '#4caf6d', '#8e5fc0', '#e07b39', '#c0c8d0', '#2e2a33', '#7ab8c9', '#b03a5b'];
export const PED_SHIRTS = ['#e8e4da', '#d94f3d', '#3d7bd9', '#e8b93c', '#4caf6d', '#8e5fc0', '#e07b39', '#5b8c5a'];
