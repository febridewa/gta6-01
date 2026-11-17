// Solmar Bay — shared tuning, palette and definitions.
// One clear job: every number the rest of the game agrees on lives here.

export const WORLD = {
  width: 3600,
  height: 3000,
  roadWidth: 64,
  block: 300,
  // Beach band and ocean along the south edge.
  beachTop: 2580,
  oceanTop: 2700,
};

export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6f9c54',
  sand: '#e8cf9a',
  sandWet: '#d9bd85',
  ocean: '#2e7f9e',
  oceanDeep: '#1f5f7d',
  road: '#3d3a38',
  roadEdge: '#2e2c2a',
  sidewalk: '#b9b2a4',
  lane: '#e8d44d',
  buildingWall: '#8a7a68',
  roofA: '#c96f4a',
  roofB: '#7d8aa0',
  roofC: '#a8573f',
  roofD: '#5d7a5a',
  roofE: '#b98a3f',
  parkPath: '#cbb98d',
  tree: '#3f7a3a',
  treeDark: '#2f5e2c',
  waterShine: 'rgba(255,255,255,0.25)',
};

export const VEHICLES = {
  sedan:  { name: 'Solano',   len: 74, wid: 36, accel: 420, maxSpeed: 470, reverse: 160, turn: 2.6, grip: 3.2, hp: 100, colors: ['#b8443a', '#3a6ea8', '#c9c2b4', '#4a4a52'] },
  taxi:   { name: 'Bay Cab',  len: 74, wid: 36, accel: 400, maxSpeed: 450, reverse: 160, turn: 2.6, grip: 3.2, hp: 100, colors: ['#e8b93a'] },
  sport:  { name: 'Cometa GT', len: 78, wid: 34, accel: 620, maxSpeed: 640, reverse: 190, turn: 3.1, grip: 4.0, hp: 80,  colors: ['#c22e2e', '#1f8a4c', '#e8e8e8'] },
  truck:  { name: 'Hauler',   len: 96, wid: 40, accel: 300, maxSpeed: 360, reverse: 130, turn: 2.0, grip: 2.6, hp: 160, colors: ['#7a6a4a', '#5a6a7a'] },
  van:    { name: 'Courier',  len: 84, wid: 38, accel: 360, maxSpeed: 400, reverse: 140, turn: 2.3, grip: 3.0, hp: 120, colors: ['#d8d8d8', '#8a3a3a'] },
  police: { name: 'SPD Cruiser', len: 76, wid: 36, accel: 560, maxSpeed: 600, reverse: 180, turn: 3.0, grip: 3.8, hp: 120, colors: ['#20242c'] },
};

export const WEAPONS = {
  pistol: { name: 'P9 Pistol', damage: 34, rate: 0.22, mag: 12, reload: 1.1, spread: 0.035, range: 560, bulletSpeed: 980 },
};

export const PLAYER_TUNING = {
  walkSpeed: 175,
  sprintSpeed: 265,
  radius: 13,
  maxHp: 100,
  maxArmor: 100,
};

export const WANTED = {
  // Heat thresholds for each star level.
  stars: [0, 18, 38, 60, 82, 100],
  heatStealCar: 18,
  heatShot: 4,
  heatKillPed: 18,
  heatKillCop: 25,
  heatMission: 12,
  decayPerSec: 1.6,
  hiddenDecayPerSec: 6,
};

export const ECONOMY = {
  startMoney: 120,
  stashValue: 100,
  fareMin: 45,
  fareMax: 95,
  bustedLoss: 0.12,
  wastedLoss: 0.10,
};

export const MISSION_REWARDS = [150, 250, 400, 500, 600, 800, 1200, 2000];

export const SAVE_KEY = 'solmarbay-save-v1';
