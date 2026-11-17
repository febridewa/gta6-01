// Solmar Bay — pedestrians: sidewalk walkers, panicked crowds, taxi fares.
// One clear job: fill the city with people who walk, flee and hail cabs.

import { WORLD } from './config.js';
import { resolveCircle, nearestRoadPoint, isOnRoad } from './city.js';

const SHIRTS = ['#d94f3d', '#3d7ad9', '#e8c33a', '#7a4fd9', '#3da86a', '#e8e8e8', '#d97ab0', '#4a4a52'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = rng.range(0, Math.PI * 2);
    this.speed = rng.range(42, 68);
    this.state = 'walk'; // walk | flee | dead | passenger | waiting
    this.target = null;
    this.fleeTimer = 0;
    this.deadTimer = 0;
    this.shirt = rng.pick(SHIRTS);
    this.skin = rng.pick(['#e8b88a', '#c98a5a', '#8a5a3a', '#f0c8a0']);
    this.panic = 0;
  }
}

export class PedManager {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.list = [];
    this.spawnTimer = 0;
    this.fare = null; // { ped, dest, state: 'waiting'|'riding'|'done' }
    this.fareTimer = 14;
  }

  reset() { this.list = []; this.fare = null; this.fareTimer = 14; }

  spawnPedAt(x, y) {
    const ped = new Ped(x, y, this.rng);
    ped.target = this.nextWalkTarget(ped);
    this.list.push(ped);
    return ped;
  }

  spawnNear(px, py, count) {
    for (let i = 0; i < count; i += 1) {
      const p = nearestRoadPoint(this.city, px + this.rng.range(-500, 500), py + this.rng.range(-500, 500));
      const side = this.rng.chance(0.5) ? 1 : -1;
      const vertical = Math.abs(p.x - px) < Math.abs(p.y - py);
      const x = vertical ? p.x + side * (WORLD.roadWidth / 2 + 14) : p.x + this.rng.range(-120, 120);
      const y = vertical ? p.y + this.rng.range(-120, 120) : p.y + side * (WORLD.roadWidth / 2 + 14);
      const ped = new Ped(x, y, this.rng);
      ped.target = this.nextWalkTarget(ped);
      this.list.push(ped);
    }
  }

  nextWalkTarget(ped) {
    const n = nearestRoadPoint(this.city, ped.x, ped.y);
    const vertical = this.rng.chance(0.5);
    const side = this.rng.chance(0.5) ? 1 : -1;
    if (vertical) return { x: n.x + side * (WORLD.roadWidth / 2 + 14), y: this.rng.range(150, 2550) };
    return { x: this.rng.range(150, 3450), y: n.y + side * (WORLD.roadWidth / 2 + 14) };
  }

  scare(x, y, radius) {
    for (const p of this.list) {
      if (p.state === 'dead' || p.state === 'passenger') continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) {
        p.state = 'flee';
        p.fleeTimer = 2.5 + Math.random() * 1.5;
        p.angle = Math.atan2(p.y - y, p.x - x);
      }
    }
  }

  update(dt, player, particles) {
    const px = player.x; const py = player.y;
    this.spawnTimer -= dt;
    const near = this.list.filter((p) => Math.hypot(p.x - px, p.y - py) < 800).length;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.8;
      if (near < 16) this.spawnNear(px, py, Math.min(4, 16 - near));
    }
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i];
      const d = Math.hypot(p.x - px, p.y - py);
      if (d > 1050) { this.list.splice(i, 1); continue; }
      if (p.state === 'dead') {
        p.deadTimer -= dt;
        if (p.deadTimer <= 0) this.list.splice(i, 1);
        continue;
      }
      if (p.state === 'passenger') continue; // rides with the player
      if (p.state === 'flee') {
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) { p.state = 'walk'; p.target = this.nextWalkTarget(p); }
        const sp = 150;
        const pos = resolveCircle(this.city, p.x + Math.cos(p.angle) * sp * dt, p.y + Math.sin(p.angle) * sp * dt, 12);
        p.x = pos.x; p.y = pos.y;
        continue;
      }
      // Walk toward the target; pick a new one on arrival.
      if (!p.target) p.target = this.nextWalkTarget(p);
      const dx = p.target.x - p.x; const dy = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) { p.target = this.nextWalkTarget(p); continue; }
      p.angle = Math.atan2(dy, dx);
      const pos = resolveCircle(this.city, p.x + Math.cos(p.angle) * p.speed * dt, p.y + Math.sin(p.angle) * p.speed * dt, 12);
      p.x = pos.x; p.y = pos.y;
    }
    this.updateFare(dt, player, particles);
  }

  updateFare(dt, player, particles) {
    this.fareTimer -= dt;
    if (!this.fare && this.fareTimer <= 0 && player.inCar && !player.inCar.destroyed) {
      this.fareTimer = 26;
      // A fare hails from the kerb near the player.
      const p = nearestRoadPoint(this.city, player.x + this.rng.range(-260, 260), player.y + this.rng.range(-260, 260));
      const side = this.rng.chance(0.5) ? 1 : -1;
      const ped = new Ped(p.x + side * (WORLD.roadWidth / 2 + 14), p.y, this.rng);
      ped.state = 'waiting';
      const dest = nearestRoadPoint(this.city, player.x + this.rng.range(-900, 900), player.y + this.rng.range(-900, 900));
      this.fare = { ped, dest, state: 'waiting', pay: 0 };
      this.list.push(ped);
      particles.addText(ped.x, ped.y - 30, 'TAXI?', '#ffe95a');
    }
    if (!this.fare) return;
    const fare = this.fare;
    if (fare.state === 'waiting') {
      if (player.inCar && Math.hypot(fare.ped.x - player.x, fare.ped.y - player.y) < 70) {
        fare.state = 'riding';
        fare.ped.state = 'passenger';
        const d = Math.hypot(fare.dest.x - player.x, fare.dest.y - player.y);
        fare.pay = Math.max(45, Math.min(95, Math.round(d / 14)));
        particles.addText(player.x, player.y - 40, 'Fare picked up!', '#7dff8a');
      }
    } else if (fare.state === 'riding') {
      fare.ped.x = player.x; fare.ped.y = player.y;
      if (Math.hypot(fare.dest.x - player.x, fare.dest.y - player.y) < 46) {
        player.money += fare.pay;
        particles.addText(player.x, player.y - 40, `+$${fare.pay}`, '#7dff8a');
        fare.ped.state = 'walk';
        fare.ped.target = this.nextWalkTarget(fare.ped);
        const idx = this.list.indexOf(fare.ped);
        if (idx >= 0) this.list.splice(idx, 1);
        this.fare = null;
        this.fareTimer = 18;
        return 'fareDone';
      }
      if (!player.inCar) {
        // Player bailed: the fare walks off.
        fare.ped.state = 'walk';
        fare.ped.target = this.nextWalkTarget(fare.ped);
        this.fare = null;
        this.fareTimer = 18;
      }
    }
    return null;
  }
}

export function isOnSidewalk(city, x, y) {
  return !isOnRoad(city, x, y);
}
