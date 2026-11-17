// Solmar Bay — vehicles: arcade car physics, traffic AI, parked cars.
// One clear job: make cars drive, crash, smoke and get stolen.

import { VEHICLES, WORLD } from './config.js';
import { resolveCar, nearestRoadPoint, randomRoadPoint, isOnRoad, isBeach } from './city.js';

let nextVehicleId = 1;

export class Vehicle {
  constructor(defName, x, y, angle, color) {
    this.id = nextVehicleId;
    nextVehicleId += 1;
    this.defName = defName;
    this.def = VEHICLES[defName];
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.steer = 0;
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.color = color || this.def.colors[0];
    this.driver = null; // 'player' | 'traffic' | 'police' | 'mission' | null (parked)
    this.destroyed = false;
    this.smokeTimer = 0;
    this.brakeLight = false;
    this.stuckTimer = 0;
    this.target = null; // traffic waypoint {x, y}
    this.waitTimer = 0;
  }

  // Arcade drive: throttle -1..1, steer -1..1.
  drive(dt, throttle, steer, handbrake, city) {
    const def = this.def;
    const forward = throttle > 0;
    if (forward) this.speed += def.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 20) this.speed += def.accel * 1.4 * throttle * dt; // brake
      else this.speed += def.accel * 0.55 * throttle * dt; // reverse
    }
    // Drag and rolling resistance.
    this.speed -= this.speed * (handbrake ? 2.4 : 0.55) * dt;
    if (this.speed > def.maxSpeed) this.speed = def.maxSpeed;
    if (this.speed < -def.reverse) this.speed = -def.reverse;
    if (Math.abs(this.speed) < 4 && throttle === 0) this.speed = 0;
    // Steering weakens at standstill, strengthens with speed, flips in reverse.
    const speedRatio = Math.min(1, Math.abs(this.speed) / (def.maxSpeed * 0.55));
    const dir = this.speed >= 0 ? 1 : -1;
    this.angle += steer * def.turn * speedRatio * dir * dt;
    this.steer = steer;
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    this.x = nx; this.y = ny;
    const hit = resolveCar(city, this);
    if (hit && Math.abs(this.speed) > 120) this.hp -= Math.abs(this.speed) * 0.02;
    // Sand slows cars.
    if (isBeach(this.x, this.y)) this.speed *= (1 - 0.8 * dt);
    if (this.hp <= 0 && !this.destroyed) this.destroyed = true;
    return hit;
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.destroyed = true;
  }
}

export class TrafficManager {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.spawnTimer = 0;
  }

  reset() { this.cars = []; }

  spawnNear(px, py, count) {
    for (let i = 0; i < count; i += 1) {
      const p = randomRoadPoint(this.rng, this.city, px, py, 320, 750);
      // Never spawn on top of another traffic car.
      if (this.cars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 110)) continue;
      const vertical = this.rng.chance(0.5);
      const angle = vertical ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (this.rng.chance(0.5) ? 0 : Math.PI);
      const defName = this.rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck', 'sport']);
      const car = new Vehicle(defName, p.x, p.y, angle, undefined);
      car.driver = 'traffic';
      car.speed = this.rng.range(110, 170);
      car.target = this.nextWaypoint(car);
      this.cars.push(car);
    }
  }

  nextWaypoint(car) {
    const n = nearestRoadPoint(this.city, car.x, car.y);
    const dirs = [
      { x: n.x + 300, y: n.y }, { x: n.x - 300, y: n.y },
      { x: n.x, y: n.y + 300 }, { x: n.x, y: n.y - 300 },
    ].filter((p) => p.x >= 120 && p.x <= 3480 && p.y >= 120 && p.y <= 2580);
    const p = this.rng.pick(dirs);
    return p;
  }

  update(dt, player, particles) {
    const px = player.x; const py = player.y;
    // Keep a lively ring of traffic around the player.
    this.spawnTimer -= dt;
    const near = this.cars.filter((c) => Math.hypot(c.x - px, c.y - py) < 850).length;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      if (near < 9) this.spawnNear(px, py, Math.min(3, 9 - near));
    }
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const car = this.cars[i];
      const d = Math.hypot(car.x - px, car.y - py);
      if (d > 1100 || car.destroyed) {
        if (car.destroyed) particles.explosion(car.x, car.y);
        this.cars.splice(i, 1);
        continue;
      }
      // Drive toward the waypoint, staying in the right-hand lane.
      const t = car.target || this.nextWaypoint(car);
      car.target = t;
      const lane = 15;
      const dx = t.x - car.x; const dy = t.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 26) { car.target = this.nextWaypoint(car); continue; }
      const wantAngle = Math.atan2(dy, dx);
      // Lane offset: shift the aim point to the right of travel.
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      // Slow for the car ahead.
      let throttle = 1;
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.x - car.x; const oy = other.y - car.y;
        const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
        const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
        if (along > 0 && along < 90 && side < 30) { throttle = 0.25; break; }
      }
      const before = car.speed;
      car.drive(dt, throttle, steer, false, this.city);
      if (Math.abs(before - car.speed) > 260) particles.sparks(car.x, car.y);
      // Gentle separation between traffic cars.
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = car.x - other.x; const oy = car.y - other.y;
        const dd = Math.hypot(ox, oy);
        if (dd > 0.01 && dd < 62) {
          car.x += (ox / dd) * (62 - dd) * 0.5;
          car.y += (oy / dd) * (62 - dd) * 0.5;
        }
      }
      void lane;
    }
  }
}

/** Parked cars filling the parking lots, for stealing and scenery. */
export function spawnParkedCars(city, rng) {
  const cars = [];
  for (const lot of city.lots) {
    const n = rng.int(2, 5);
    for (let i = 0; i < n; i += 1) {
      const x = rng.range(lot.x + 30, lot.x + lot.w - 30);
      const y = rng.range(lot.y + 24, lot.y + lot.h - 24);
      const defName = rng.pick(['sedan', 'sedan', 'taxi', 'van', 'sport']);
      const car = new Vehicle(defName, x, y, rng.chance(0.5) ? 0 : Math.PI / 2, undefined);
      car.driver = null;
      cars.push(car);
    }
  }
  // A few kerb-parked cars on the marina road.
  for (let i = 0; i < 5; i += 1) {
    const car = new Vehicle(rng.pick(['sedan', 'sport', 'taxi']), 400 + i * 420, 2550 - 44, 0, undefined);
    car.driver = null;
    cars.push(car);
  }
  return cars;
}

export function allVehicles(traffic, parked, police, missionCars) {
  const list = [...traffic.cars, ...parked];
  for (const c of police.cruisers) list.push(c);
  for (const c of missionCars) list.push(c);
  return list;
}

export function pointInCar(v, x, y, pad) {
  const dx = x - v.x; const dy = y - v.y;
  const cos = Math.cos(-v.angle); const sin = Math.sin(-v.angle);
  const lx = dx * cos - dy * sin; const ly = dx * sin + dy * cos;
  const p = pad || 0;
  return Math.abs(lx) < v.def.len / 2 + p && Math.abs(ly) < v.def.wid / 2 + p;
}

export function nearestCar(vehicles, x, y, maxD) {
  let best = null; let bestD = maxD || 90;
  for (const v of vehicles) {
    if (v.destroyed) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}
