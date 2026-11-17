// Solmar Bay — screenshot scenes behind ?shot=<name>&seed=<n>.
// One clear job: put the real game into a fixed, readable state and steer
// it forward a few seconds, so each screenshot shows several systems at once.

import { Vehicle } from './vehicles.js';

function placePlayerInCar(G, defName, x, y, angle, color) {
  const car = new Vehicle(defName, x, y, angle, color);
  car.driver = 'player';
  // The staged car is tough: a screenshot chase must not end in a wreck.
  car.hp = 300; car.maxHp = 300;
  G.player.inCar = car;
  G.player.x = x; G.player.y = y;
  G.player.angle = angle;
  G.missions.missionCars.push(car);
  return car;
}

function spawnCruiser(G, x, y, angle) {
  const c = new Vehicle('police', x, y, angle, '#20242c');
  c.driver = 'police';
  c.speed = 260;
  G.police.cruisers.push(c);
  return c;
}

function spawnTrafficRow(G, roadY, xStart) {
  const rng = G.rng;
  const defs = ['sedan', 'taxi', 'van', 'sport'];
  for (let i = 0; i < 6; i += 1) {
    const car = new Vehicle(rng.pick(defs), xStart + i * 260 + rng.range(-40, 40), roadY + (i % 2 === 0 ? -14 : 14), i % 2 === 0 ? 0 : Math.PI, undefined);
    car.driver = 'traffic';
    car.speed = rng.range(120, 180);
    car.target = { x: car.x + (i % 2 === 0 ? 600 : -600), y: car.y };
    G.traffic.cars.push(car);
  }
}

function spawnPedCrowd(G, cx, cy, n) {
  for (let i = 0; i < n; i += 1) {
    const p = G.peds.spawnPedAt(cx + G.rng.range(-260, 260), cy + G.rng.range(-160, 160));
    p.state = 'walk';
  }
}

export function setupShot(G, name) {
  const city = G.city;
  const P = city.places;
  G.screen = 'play';
  G.shotMode = name;
  G.shotTime = 0;
  G.shotSteps = 0;
  // The screenshot player is hard to kill: the scene must stay readable.
  G.player.hp = 100;
  G.player.armor = 100;
  // A busy living city behind every shot.
  G.traffic.spawnNear(1800, 1350, 8);
  G.peds.spawnNear(1800, 1350, 14);

  if (name === 'chase') {
    // Mission 7 active, three-star chase downtown: player in a Cometa GT
    // with cruisers on the tail, minimap, stars and objective all visible.
    G.missions.start(7, G);
    G.missions.stepIndex = 2; // Escape to the Safehouse
    G.missions.enterStep(G);
    // One straight run east along 14th Street: no corner to crash into.
    placePlayerInCar(G, 'sport', 1200, 1350, 0, '#c22e2e');
    G.police.addHeat(62);
    // Cruisers start behind the player, so the frame reads as a pursuit.
    spawnCruiser(G, 950, 1350, 0);
    spawnCruiser(G, 850, 1420, 0);
    spawnCruiser(G, 1000, 1290, 0);
    // Traffic one street over, so the chase line stays clear but busy.
    spawnTrafficRow(G, 1050, 700);
    // Clear any ambient traffic that wandered onto the chase lane.
    G.traffic.cars = G.traffic.cars.filter((c) => !(Math.abs(c.y - 1350) < 60 && c.x > 1000));
    spawnPedCrowd(G, 1800, 1200, 6);
    G.shotWaypoints = [{ x: 3450, y: 1350 }];
    G.shotWaypoint = 0;
    G.camera.x = 1200; G.camera.y = 1350;
  } else if (name === 'street') {
    // Mission 4 shootout at Club Lumen: Mara on foot, gun out, Vipers in
    // the street, traffic and pedestrians around her. No police heat here:
    // the frame is the shootout, not an arrest.
    G.player.x = P.club.x + 40; G.player.y = P.club.y + 120;
    G.player.angle = -Math.PI / 2;
    G.missions.start(4, G);
    G.missions.stepIndex = 1;
    G.missions.enterStep(G);
    spawnPedCrowd(G, P.club.x, P.club.y, 10);
    G.traffic.spawnNear(P.club.x, P.club.y, 5);
    G.camera.x = P.club.x + 40; G.camera.y = P.club.y + 60;
  } else if (name === 'drive') {
    // Taxi fare along the marina: sunset beach, ocean, palm-lined road.
    G.missions.start(2, G);
    placePlayerInCar(G, 'taxi', 1500, 2550, 0, '#e8b93a');
    const fare = G.peds.spawnPedAt(1900, 2550 - 46);
    fare.state = 'waiting';
    G.peds.fare = { ped: fare, dest: { x: 3000, y: 2550 }, state: 'waiting', pay: 80 };
    // Traffic on the street just north, for the taxi to pass — the marina
    // road itself stays clear so the cab can run.
    spawnTrafficRow(G, 2250, 1800);
    G.traffic.cars = G.traffic.cars.filter((c) => !(Math.abs(c.y - 2550) < 60 && c.x > 1400));
    G.shotWaypoints = [{ x: 3450, y: 2550 }];
    G.shotWaypoint = 0;
    G.camera.x = 1650; G.camera.y = 2520;
  } else if (name === 'shootout') {
    // Mission 6 at Warehouse 9: Mara in cover, Vipers advancing at range.
    // Her own gunfire will draw a star or two while the frame runs.
    G.player.x = P.warehouse.x - 120; G.player.y = P.warehouse.y + 100;
    G.player.angle = 0;
    G.missions.start(6, G);
    G.missions.stepIndex = 1;
    G.missions.enterStep(G);
    spawnPedCrowd(G, P.warehouse.x, P.warehouse.y + 200, 5);
    G.camera.x = P.warehouse.x - 60; G.camera.y = P.warehouse.y + 60;
  }
}

/** Steer the scene forward one fixed step, for deterministic screenshots. */
export function shotAutopilot(G, dt) {
  G.shotSteps += 1;
  const input = G.input;
  if ((G.shotMode === 'chase' || G.shotMode === 'drive') && G.player.inCar) {
    const car = G.player.inCar;
    input.keys.add('KeyW');
    // Steer toward the current waypoint on the road loop.
    const wps = G.shotWaypoints;
    if (wps && wps.length > 0) {
      let wp = wps[G.shotWaypoint || 0];
      if (Math.hypot(wp.x - car.x, wp.y - car.y) < 150) {
        G.shotWaypoint = Math.min(wps.length - 1, (G.shotWaypoint || 0) + 1);
        wp = wps[G.shotWaypoint];
      }
      const want = Math.atan2(wp.y - car.y, wp.x - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > 0.12) input.keys.add('KeyD');
      else if (diff < -0.12) input.keys.add('KeyA');
      else { input.keys.delete('KeyA'); input.keys.delete('KeyD'); }
    }
  }
  if (G.shotMode === 'street' || G.shotMode === 'shootout') {
    // Aim at the nearest living enemy and fire in short bursts.
    const e = G.missions.enemies.find((en) => en.hp > 0);
    if (e) {
      G.input.mouse.worldX = e.x;
      G.input.mouse.worldY = e.y;
      G.player.angle = Math.atan2(e.y - G.player.y, e.x - G.player.x);
      if (G.shotSteps % 30 < 12) G.input.mouse.down = true;
      else G.input.mouse.down = false;
    }
  }
}
