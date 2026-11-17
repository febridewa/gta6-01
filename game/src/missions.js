// Solmar Bay — the story: 8 missions for Mara Solis, from a favour for an
// old friend to the crown of the bay. One clear job: run mission steps
// (go, pick up, deliver, kill, chase, escape) and pay for them.

import { Vehicle } from './vehicles.js';
import { MISSION_REWARDS } from './config.js';
import { resolveCircle, nearestRoadPoint } from './city.js';

export const MISSIONS = [
  {
    id: 1, title: 'Welcome Back', giver: 'Eddie Rook',
    brief: 'Mara is back in Solmar Bay after three years away. Eddie Rook, her old fixer, has a garage on 4th Avenue and a job that needs a driver. Get to the garage and hear him out.',
    reward: MISSION_REWARDS[0],
    steps: [{ type: 'goto', place: 'garage', r: 60, label: 'Drive to Rook\'s Garage' }],
  },
  {
    id: 2, title: 'The Pickup', giver: 'Eddie Rook',
    brief: 'A package is waiting at the Marina Boardwalk. Collect it, then run it to Lena Marlowe at Club Lumen before the buyers lose patience. Seventy-five seconds, no excuses.',
    reward: MISSION_REWARDS[1],
    steps: [
      { type: 'pickup', place: 'marina', r: 55, label: 'Collect the package at the Marina' },
      { type: 'deliver', place: 'club', r: 60, time: 75, label: 'Deliver to Club Lumen' },
    ],
  },
  {
    id: 3, title: 'Hot Wheels', giver: 'Eddie Rook',
    brief: 'A Cometa GT is parked outside Old Town Plaza, keys in the ignition, owner nowhere. Take it and bring it to the Chop Shop on the east side. The SPD will not love you for it.',
    reward: MISSION_REWARDS[2],
    steps: [
      { type: 'steal', place: 'plaza', r: 70, label: 'Steal the Cometa GT at the Plaza' },
      { type: 'deliver', place: 'chopshop', r: 70, label: 'Deliver the Cometa to the Chop Shop' },
    ],
  },
  {
    id: 4, title: 'Club Trouble', giver: 'Lena Marlowe',
    brief: 'The Vipers, a rival crew, have walked into Club Lumen waving guns and demanding protection money. Lena is done paying. Clear them out — all six — and make sure she stays standing.',
    reward: MISSION_REWARDS[3],
    steps: [
      { type: 'goto', place: 'club', r: 80, label: 'Get to Club Lumen' },
      { type: 'kill', place: 'club', count: 6, label: 'Clear out the Vipers (0/6)' },
    ],
  },
  {
    id: 5, title: 'The Chase', giver: 'Eddie Rook',
    brief: 'A courier van is carrying a case of cash across town to the Vipers. Run it down, stop it — ram it or shoot it — grab the case and bring it home to the garage.',
    reward: MISSION_REWARDS[4],
    steps: [
      { type: 'chase', place: 'courier', label: 'Run down the courier van' },
      { type: 'pickup', place: 'courier', r: 60, label: 'Grab the case' },
      { type: 'deliver', place: 'garage', r: 60, label: 'Bring the case to the Garage' },
    ],
  },
  {
    id: 6, title: 'Payback', giver: 'Lena Marlowe',
    brief: 'The Vipers store their guns in Warehouse 9. Hit it hard, put ten of them down, then get out of there with the whole SPD on your tail and lose them.',
    reward: MISSION_REWARDS[5],
    steps: [
      { type: 'goto', place: 'warehouse', r: 80, label: 'Get to Warehouse 9' },
      { type: 'kill', place: 'warehouse', count: 10, label: 'Take down the Vipers (0/10)' },
      { type: 'escape', seconds: 20, label: 'Lose the cops' },
    ],
  },
  {
    id: 7, title: 'The Score', giver: 'Eddie Rook',
    brief: 'Solmar National Bank, Friday, 4pm. Walk in, take the vault cash, walk out — and then drive like the whole city is watching, because it is. Lose the four-star heat at the Safehouse.',
    reward: MISSION_REWARDS[6],
    steps: [
      { type: 'goto', place: 'bank', r: 60, label: 'Get to Solmar National Bank' },
      { type: 'pickup', place: 'bank', r: 55, label: 'Grab the vault cash', channel: 2 },
      { type: 'deliver', place: 'safehouse', r: 70, label: 'Escape to the Safehouse' },
      { type: 'escape', seconds: 15, label: 'Lay low until the heat dies' },
    ],
  },
  {
    id: 8, title: 'King of the Bay', giver: 'Lena Marlowe',
    brief: 'The Vipers are done talking. Their whole crew is coming down the Lighthouse Pier to finish this. Hold the pier, put eight of them down, and Solmar Bay is yours.',
    reward: MISSION_REWARDS[7],
    steps: [
      { type: 'goto', place: 'lighthouse', r: 90, label: 'Hold the Lighthouse Pier' },
      { type: 'kill', place: 'lighthouse', count: 8, label: 'Defend the pier (0/8)' },
    ],
  },
];

export class MissionManager {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.current = null;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.stepState = {};
    this.enemies = [];
    this.missionCars = [];
    this.kills = 0;
    this.message = null;
    this.messageTimer = 0;
    this.targetVan = null;
    this.completed = new Set();
  }

  get active() { return this.current !== null; }
  get step() { return this.current ? this.current.steps[this.stepIndex] : null; }

  reset(ctx) {
    // Keep the car the player is sitting in; everything else mission-owned goes.
    const keep = ctx && ctx.player && ctx.player.inCar ? ctx.player.inCar : null;
    this.current = null;
    this.stepIndex = 0;
    this.enemies = [];
    this.missionCars = keep ? [keep] : [];
    this.targetVan = null;
  }

  start(id, ctx) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return false;
    this.reset(ctx);
    this.current = def;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.stepState = {};
    this.kills = 0;
    this.enterStep(ctx);
    return true;
  }

  placePos(name) {
    const p = this.city.places[name];
    return p ? { x: p.x, y: p.y, label: p.label } : { x: 1800, y: 1500, label: name };
  }

  enterStep(ctx) {
    const step = this.step;
    if (!step) return;
    this.stepTimer = step.time || 0;
    this.stepState = {};
    if (step.type === 'kill') {
      const pos = this.placePos(step.place);
      const n = step.count;
      for (let i = 0; i < n; i += 1) {
        const a = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(60, 220);
        const x = pos.x + Math.cos(a) * r;
        const y = pos.y + Math.sin(a) * r;
        this.enemies.push({ x, y, angle: 0, hp: 100, shootTimer: 1 + this.rng.range(0, 1), state: 'fight', speed: 120 });
      }
      this.kills = 0;
    }
    if (step.type === 'steal') {
      const pos = this.placePos(step.place);
      const car = new Vehicle('sport', pos.x + 60, pos.y, 0, '#c22e2e');
      car.driver = null;
      this.missionCars.push(car);
      this.stepState.car = car;
    }
    if (step.type === 'chase') {
      const pos = this.placePos(step.place);
      const van = new Vehicle('van', pos.x, pos.y, Math.PI / 2, '#d8d8d8');
      van.driver = 'mission';
      van.hp = 160; van.maxHp = 160;
      van.target = nearestRoadPoint(this.city, pos.x, pos.y + 600);
      this.missionCars.push(van);
      this.targetVan = van;
      this.stepState.van = van;
    }
    if (step.type === 'escape') {
      ctx.police.addHeat(step.seconds >= 20 ? 42 : 30);
      this.stepTimer = step.seconds;
    }
    if (step.type === 'pickup' && step.channel) this.stepState.channel = step.channel;
    this.showMessage(step.label);
  }

  showMessage(text) {
    this.message = text;
    this.messageTimer = 3.2;
  }

  stepTarget() {
    const step = this.step;
    if (!step) return null;
    if (step.place) return this.placePos(step.place);
    if (step.type === 'chase' && this.targetVan) return { x: this.targetVan.x, y: this.targetVan.y, label: 'Courier Van' };
    return null;
  }

  update(dt, ctx) {
    const { player, police, bullets, audio, particles } = ctx;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (!this.current) return null;

    // Enemies fight the player.
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (e.hp <= 0) { this.enemies.splice(i, 1); continue; }
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      e.angle = Math.atan2(player.y - e.y, player.x - e.x);
      // Hold a firing range: close in when far, back off when too close,
      // so a firefight spreads out instead of piling onto the player.
      if (d > 260) {
        const pos = resolveCircle(this.city, e.x + Math.cos(e.angle) * e.speed * dt, e.y + Math.sin(e.angle) * e.speed * dt, 12);
        e.x = pos.x; e.y = pos.y;
      } else if (d < 140) {
        const pos = resolveCircle(this.city, e.x - Math.cos(e.angle) * e.speed * 0.6 * dt, e.y - Math.sin(e.angle) * e.speed * 0.6 * dt, 12);
        e.x = pos.x; e.y = pos.y;
      }
      e.shootTimer -= dt;
      if (d < 340 && e.shootTimer <= 0) {
        e.shootTimer = 1.4 + Math.random() * 0.8;
        bullets.fire(e.x, e.y, e.angle + (Math.random() - 0.5) * 0.3, 'enemy', 6);
        audio.enemyShoot();
        particles.muzzle(e.x + Math.cos(e.angle) * 16, e.y + Math.sin(e.angle) * 16, e.angle);
      }
    }

    // The courier van flees along the roads.
    if (this.targetVan && !this.targetVan.destroyed) {
      const van = this.targetVan;
      const t = van.target;
      const dx = t.x - van.x; const dy = t.y - van.y;
      if (Math.hypot(dx, dy) < 40) {
        van.target = nearestRoadPoint(this.city, van.x + (this.rng.chance(0.5) ? 600 : -600), van.y + (this.rng.chance(0.5) ? 600 : -600));
      }
      const wantAngle = Math.atan2(t.y - van.y, t.x - van.x);
      let diff = wantAngle - van.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      van.drive(dt, 0.85, Math.max(-1, Math.min(1, diff * 2.2)), false, this.city);
      if (van.hp < 60 && Math.random() < dt * 2) particles.smoke(van.x, van.y, false);
    }

    const step = this.step;
    if (!step) return null;
    const target = this.stepTarget();
    const pd = target ? Math.hypot(player.x - target.x, player.y - target.y) : Infinity;

    if (step.type === 'goto' || step.type === 'deliver') {
      if (step.time) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) return this.fail(ctx, 'Too slow — the deal fell through.');
      }
      if (pd < (step.r || 60)) return this.nextStep(ctx);
    } else if (step.type === 'pickup') {
      if (pd < (step.r || 55)) {
        if (step.channel) {
          this.stepState.channel -= dt;
          if (this.stepState.channel <= 0) {
            audio.pickup();
            return this.nextStep(ctx);
          }
        } else {
          audio.pickup();
          return this.nextStep(ctx);
        }
      }
    } else if (step.type === 'steal') {
      const car = this.stepState.car;
      if (car && player.inCar === car) {
        police.addHeat(12);
        return this.nextStep(ctx);
      }
    } else if (step.type === 'chase') {
      const van = this.stepState.van;
      if (!van) return this.nextStep(ctx);
      if (van.destroyed || van.hp <= 40) {
        van.speed = 0;
        if (van.hp <= 40) van.hp = 40;
        particles.addText(van.x, van.y - 40, 'Van stopped!', '#7dff8a');
        return this.nextStep(ctx);
      }
    } else if (step.type === 'kill') {
      const remaining = step.count - this.kills;
      if (remaining <= 0) return this.nextStep(ctx);
    } else if (step.type === 'escape') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && police.stars() === 0) {
        return this.nextStep(ctx);
      }
      if (this.stepTimer <= -30) return this.fail(ctx, 'The cops never lost you.');
    }
    return null;
  }

  onEnemyKilled(ctx) {
    this.kills += 1;
    const step = this.step;
    if (step && step.type === 'kill') {
      this.showMessage(`Vipers down: ${this.kills}/${step.count}`);
    }
  }

  nextStep(ctx) {
    this.stepIndex += 1;
    if (this.stepIndex >= this.current.steps.length) {
      return this.complete(ctx);
    }
    this.enterStep(ctx);
    return null;
  }

  complete(ctx) {
    const def = this.current;
    ctx.player.money += def.reward;
    ctx.audio.missionDone();
    ctx.particles.addText(ctx.player.x, ctx.player.y - 50, `Mission complete! +$${def.reward}`, '#7dff8a');
    this.completed.add(def.id);
    this.current = null;
    this.stepIndex = 0;
    this.enemies = [];
    this.targetVan = null;
    return { type: 'missionComplete', mission: def };
  }

  fail(ctx, reason) {
    const def = this.current;
    ctx.audio.missionFail();
    this.current = null;
    this.stepIndex = 0;
    this.enemies = [];
    this.missionCars = [];
    this.targetVan = null;
    return { type: 'missionFailed', mission: def, reason };
  }

  abort() {
    this.current = null;
    this.stepIndex = 0;
    this.enemies = [];
    this.missionCars = [];
    this.targetVan = null;
  }
}
