// Solmar Bay — the wanted level and the Solmar Police Department.
// One clear job: turn heat into stars, stars into cruisers and cops,
// and cops into chases, arrests and shootouts.

import { WANTED } from './config.js';
import { Vehicle, nearestCar, pointInCar } from './vehicles.js';
import { randomRoadPoint, resolveCircle } from './city.js';

export class PoliceManager {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.cruisers = [];
    this.footCops = [];
    this.spawnTimer = 0;
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
    this.sirenActive = false;
  }

  reset() {
    this.heat = 0;
    this.cruisers = [];
    this.footCops = [];
    this.bustedTimer = 0;
  }

  stars() {
    const s = WANTED.stars;
    if (this.heat >= s[5]) return 5;
    if (this.heat >= s[4]) return 4;
    if (this.heat >= s[3]) return 3;
    if (this.heat >= s[2]) return 2;
    if (this.heat >= s[1]) return 1;
    return 0;
  }

  addHeat(n) {
    this.heat = Math.min(100, this.heat + n);
    this.hiddenTimer = 0;
  }

  clear() { this.heat = 0; this.cruisers = []; this.footCops = []; }

  desiredCruisers() {
    const s = this.stars();
    return s === 0 ? 0 : Math.min(5, s + (s >= 3 ? 1 : 0));
  }

  update(dt, player, particles, bullets, audio) {
    const stars = this.stars();
    // Heat decays; faster when no police can see the player.
    let nearestCop = Infinity;
    for (const c of this.cruisers) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.y - player.y));
    for (const c of this.footCops) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.y - player.y));
    if (nearestCop > 620) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > 4) this.heat = Math.max(0, this.heat - WANTED.hiddenDecayPerSec * dt);
    } else {
      this.hiddenTimer = 0;
      this.heat = Math.max(0, this.heat - WANTED.decayPerSec * dt);
    }

    // Spawn cruisers up to the wanted level.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.cruisers.length < this.desiredCruisers()) {
      this.spawnTimer = 1.6;
      const p = randomRoadPoint(this.rng, this.city, player.x, player.y, 420, 800);
      const cruiser = new Vehicle('police', p.x, p.y, Math.atan2(player.y - p.y, player.x - p.x), '#20242c');
      cruiser.driver = 'police';
      cruiser.speed = 200;
      this.cruisers.push(cruiser);
    }

    // Cruiser pursuit: steer at the player, ram, and drop a foot cop when close.
    for (let i = this.cruisers.length - 1; i >= 0; i -= 1) {
      const c = this.cruisers[i];
      if (c.destroyed) {
        particles.explosion(c.x, c.y);
        audio.explosion();
        this.cruisers.splice(i, 1);
        continue;
      }
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      if (d > 1300) { this.cruisers.splice(i, 1); continue; }
      const wantAngle = Math.atan2(player.y - c.y, player.x - c.x);
      let diff = wantAngle - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.4));
      // Unstick: reverse briefly if barely moving while far from the player.
      c.stuckTimer += dt;
      if (Math.abs(c.speed) < 25 && d > 120) {
        if (c.stuckTimer > 1.2) { c.stuckTimer = 0; c.reverseTimer = 0.9; }
      }
      let throttle = 1;
      if (c.reverseTimer > 0) { c.reverseTimer -= dt; throttle = -1; }
      const before = c.speed;
      c.drive(dt, throttle, steer, false, this.city);
      if (Math.abs(before) > 200 && Math.abs(c.speed) < 60) particles.sparks(c.x, c.y);
      // Ram the player's car.
      if (player.inCar && !player.inCar.destroyed) {
        const v = player.inCar;
        const dd = Math.hypot(v.x - c.x, v.y - c.y);
        if (dd < 66) {
          const push = 66 - dd;
          const a = Math.atan2(v.y - c.y, v.x - c.x);
          v.x += Math.cos(a) * push * 0.6;
          v.y += Math.sin(a) * push * 0.6;
          v.damage(1.2 * dt * 10);
          c.speed *= 0.8;
          if (Math.random() < 0.05) { particles.sparks(v.x, v.y); audio.crash(0.4); }
        }
      }
      // Drop a foot cop when the player is on foot and the cruiser is close.
      if (!player.inCar && d < 110 && this.footCops.length < stars + 1 && Math.random() < dt * 0.5) {
        this.footCops.push({ x: c.x, y: c.y, angle: 0, hp: 100, shootTimer: 1, state: 'chase' });
        c.speed = 0;
      }
      if (c.hp < 40 && Math.random() < dt * 2) particles.smoke(c.x, c.y, false);
    }

    // Foot cops: chase on foot, shoot at 2+ stars, arrest up close.
    for (let i = this.footCops.length - 1; i >= 0; i -= 1) {
      const cop = this.footCops[i];
      if (cop.hp <= 0) { this.footCops.splice(i, 1); continue; }
      const d = Math.hypot(player.x - cop.x, player.y - cop.y);
      if (d > 1100) { this.footCops.splice(i, 1); continue; }
      if (player.inCar) {
        // Cops give up chasing a car on foot; return to the cruiser.
        this.footCops.splice(i, 1);
        continue;
      }
      cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
      if (d > 36) {
        const sp = 165;
        const pos = resolveCircle(this.city, cop.x + Math.cos(cop.angle) * sp * dt, cop.y + Math.sin(cop.angle) * sp * dt, 12);
        cop.x = pos.x; cop.y = pos.y;
      }
      cop.shootTimer -= dt;
      if (stars >= 2 && d < 320 && d > 50 && cop.shootTimer <= 0) {
        cop.shootTimer = 0.9 + Math.random() * 0.5;
        const aim = cop.angle + (Math.random() - 0.5) * 0.35;
        bullets.fire(cop.x, cop.y, aim, 'cop', 7);
        audio.enemyShoot();
      }
      // Arrest: a cop standing on the player for a while busts them.
      if (d < 36) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.4) {
          this.bustedTimer = 0;
          return 'busted';
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }
    }

    this.sirenActive = stars > 0 && (this.cruisers.length > 0 || this.footCops.length > 0);
    return null;
  }
}

export function copCount(police) {
  return police.cruisers.length + police.footCops.length;
}
