// Solmar Bay — bullets and shooting resolution.
// One clear job: fly a bullet, test what it hits, report the damage.

import { WEAPONS } from './config.js';

export class Bullets {
  constructor() {
    this.list = [];
  }

  fire(x, y, angle, from, damage) {
    const w = WEAPONS.pistol;
    const spread = (Math.random() - 0.5) * w.spread * 2;
    const a = angle + spread;
    this.list.push({
      x, y,
      vx: Math.cos(a) * w.bulletSpeed,
      vy: Math.sin(a) * w.bulletSpeed,
      life: w.range / w.bulletSpeed,
      damage: damage || w.damage,
      from,
    });
  }

  update(dt, world) {
    // world: { city, peds, enemies, police, player, vehicles, particles, onPedHit, onCopHit, onPlayerHit, onCarHit }
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const b = this.list[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.life <= 0;
      if (!dead) dead = this.hitTest(b, world);
      if (dead) this.list.splice(i, 1);
    }
  }

  hitTest(b, world) {
    const { city, player } = world;
    // Buildings stop bullets.
    for (const r of city.buildings) {
      if (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) {
        world.particles.sparks(b.x, b.y);
        return true;
      }
    }
    if (b.from === 'player' || b.from === 'enemy') {
      // Hit a pedestrian?
      for (const p of world.peds.list) {
        if (p.state === 'dead') continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
          world.particles.blood(b.x, b.y);
          if (world.onPedHit) world.onPedHit(p, b);
          return true;
        }
      }
      // Hit a mission enemy?
      for (const e of world.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 15) {
          world.particles.blood(b.x, b.y);
          if (world.onEnemyHit) world.onEnemyHit(e, b);
          return true;
        }
      }
      // Hit a foot cop?
      for (const c of world.police.footCops) {
        if (c.hp <= 0) continue;
        if (Math.hypot(c.x - b.x, c.y - b.y) < 15) {
          world.particles.blood(b.x, b.y);
          if (world.onCopHit) world.onCopHit(c, b);
          return true;
        }
      }
      // Hit a car?
      for (const v of world.vehicles) {
        if (v.destroyed) continue;
        const dx = b.x - v.x; const dy = b.y - v.y;
        const cos = Math.cos(-v.angle); const sin = Math.sin(-v.angle);
        const lx = dx * cos - dy * sin; const ly = dx * sin + dy * cos;
        if (Math.abs(lx) < v.def.len / 2 && Math.abs(ly) < v.def.wid / 2) {
          world.particles.sparks(b.x, b.y);
          if (world.onCarHit) world.onCarHit(v, b);
          return true;
        }
      }
    }
    if (b.from === 'enemy' || b.from === 'cop') {
      if (player.inCar) {
        const v = player.inCar;
        const dx = b.x - v.x; const dy = b.y - v.y;
        const cos = Math.cos(-v.angle); const sin = Math.sin(-v.angle);
        const lx = dx * cos - dy * sin; const ly = dx * sin + dy * cos;
        if (Math.abs(lx) < v.def.len / 2 && Math.abs(ly) < v.def.wid / 2) {
          world.particles.sparks(b.x, b.y);
          if (world.onCarHit) world.onCarHit(v, b);
          return true;
        }
      } else if (Math.hypot(player.x - b.x, player.y - b.y) < 14) {
        world.particles.blood(b.x, b.y);
        if (world.onPlayerHit) world.onPlayerHit(b.damage);
        return true;
      }
    }
    return false;
  }
}
