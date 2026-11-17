// Solmar Bay — the game itself: state machine, loop, camera, collisions
// between the systems, and the debug hook the tests read.
// One clear job: own the frame and keep every system in step.

import { buildCity, resolveCircle } from './city.js';
import { makeRng } from './rng.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { Bullets } from './combat.js';
import { TrafficManager, spawnParkedCars, allVehicles, pointInCar } from './vehicles.js';
import { PedManager } from './people.js';
import { PoliceManager } from './police.js';
import { Player } from './player.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { SaveManager } from './save.js';
import { setupShot, shotAutopilot } from './shots.js';
import { ECONOMY, WANTED } from './config.js';

const DEFAULT_SEED = 20261117;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.params = new URLSearchParams(window.location.search);
    this.seed = Number(this.params.get('seed') || DEFAULT_SEED);
    this.rng = makeRng(this.seed);
    this.city = buildCity(this.seed);
    this.input = new Input(canvas);
    this.audio = new SoundEngine();
    this.particles = new Particles();
    this.bullets = new Bullets();
    this.traffic = new TrafficManager(this.city, this.rng);
    this.parked = spawnParkedCars(this.city, this.rng);
    this.peds = new PedManager(this.city, this.rng);
    this.police = new PoliceManager(this.city, this.rng);
    this.player = new Player(1080, 700);
    this.missions = new MissionManager(this.city, this.rng);
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    this.save = new SaveManager();
    this.camera = { x: 1800, y: 1350, zoom: 0.9 };
    this.screen = 'title';
    this.time = 0;
    this.briefingMission = null;
    this.returnScreen = 'title';
    this.lastMission = null;
    this.failReason = null;
    this.lastLoss = 0;
    this.saveMessage = null;
    this.saveMessageTimer = 0;
    this.shotMode = this.params.get('shot') || null;
    this.shotSteps = 0;
    this.shotReady = false;
    this.titleAngle = 0;

    window.__solmar = { game: this, ready: true, shotReady: false, errors: [] };
    window.addEventListener('error', (e) => {
      window.__solmar.errors.push(String(e.message || e.error));
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (this.shotMode) {
      setupShot(this, this.shotMode);
      // Run the scene forward in fixed steps, then freeze it: the frame the
      // screenshot takes is deterministic for the seed.
      for (let i = 0; i < 240; i += 1) this.update(1 / 60, true);
      this.render();
      this.shotReady = true;
      window.__solmar.shotReady = true;
    }
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      try {
        if (!this.shotMode || !this.shotReady) this.update(dt, false);
        this.render();
      } catch (e) {
        // Never let one bad frame kill the loop; record it for the tests.
        window.__solmar.errors.push(String((e && e.message) || e));
      }
      this.handleClicks();
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.resize(window.innerWidth, window.innerHeight, dpr);
  }

  // --- Flow ---------------------------------------------------------------

  newGame() {
    this.save.clear();
    this.player = new Player(1080, 700);
    this.player.money = ECONOMY.startMoney;
    this.missions = new MissionManager(this.city, this.rng);
    this.police.reset();
    this.traffic.reset();
    this.peds.reset();
    this.city = buildCity(this.seed);
    this.parked = spawnParkedCars(this.city, this.rng);
    this.screen = 'play';
    this.audio.resume();
    this.audio.engineStart();
  }

  continueGame() {
    this.save.apply(this);
    this.screen = 'play';
    this.audio.resume();
    this.audio.engineStart();
  }

  respawn(placeName) {
    const p = this.city.places[placeName];
    this.player.reset(p.x + 40, p.y + 40);
    this.police.clear();
    this.missions.abort();
    this.screen = 'play';
  }

  // --- Update ---------------------------------------------------------------

  update(dt, isShotStep) {
    this.time += dt;
    if (this.saveMessageTimer > 0) {
      this.saveMessageTimer -= dt;
      if (this.saveMessageTimer <= 0) this.saveMessage = null;
    }
    const input = this.input;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    input.mouse.worldX = this.camera.x + (input.mouse.x - w / 2) / this.camera.zoom;
    input.mouse.worldY = this.camera.y + (input.mouse.y - h / 2) / this.camera.zoom;

    if (this.screen === 'title') {
      this.titleAngle += dt * 0.05;
      this.camera.x = 1800 + Math.sin(this.titleAngle) * 700;
      this.camera.y = 1350 + Math.cos(this.titleAngle * 0.7) * 400;
      this.traffic.update(dt, { x: this.camera.x, y: this.camera.y, inCar: null }, this.particles);
      this.peds.update(dt, { x: this.camera.x, y: this.camera.y, inCar: null, money: 0 }, this.particles);
      this.particles.update(dt);
      return;
    }
    if (this.screen !== 'play') return;

    if (this.shotMode && !isShotStep) return; // frozen frame
    if (this.shotMode) shotAutopilot(this, dt);

    // Pause and shortcuts.
    if (input.wasPressed('Escape')) { this.screen = 'pause'; return; }
    if (input.wasPressed('KeyM')) {
      this.audio.setMusic(!this.audio.musicOn);
      this.missions.showMessage(this.audio.musicOn ? 'Music on' : 'Music off');
    }
    if (input.wasPressed('KeyF')) {
      if (this.save.save(this)) {
        this.saveMessage = 'Game saved.';
        this.saveMessageTimer = 2;
      }
    }

    const ctx = {
      city: this.city, audio: this.audio, particles: this.particles,
      bullets: this.bullets, police: this.police, peds: this.peds,
      traffic: this.traffic, parked: this.parked, missionCars: this.missions.missionCars,
      player: this.player,
    };

    this.player.update(dt, input, ctx);
    this.traffic.update(dt, this.player, this.particles);
    this.peds.update(dt, this.player, this.particles);
    const busted = this.police.update(dt, this.player, this.particles, this.bullets, this.audio);
    if (busted === 'busted' && !this.shotMode) { this.getBusted(); return; }
    const missionEvent = this.missions.update(dt, ctx);
    if (missionEvent) this.handleMissionEvent(missionEvent);
    this.bullets.update(dt, this.bulletWorld(ctx));
    this.particles.update(dt);
    this.collideCars();
    this.collidePlayerWithTraffic();
    this.checkStashes();
    this.audio.sirenUpdate(this.police.sirenActive, dt);

    // Screenshot scenes never end: keep the staged player alive and free.
    if (this.shotMode) {
      if (this.player.hp < 60) this.player.hp = 100;
      this.player.dead = false;
    }

    if (this.player.dead) { this.getWasted(); return; }

    // Camera follows the player, clamped to the world.
    const tx = Math.max(w / 2 / this.camera.zoom, Math.min(3600 - w / 2 / this.camera.zoom, this.player.x));
    const ty = Math.max(h / 2 / this.camera.zoom, Math.min(3000 - h / 2 / this.camera.zoom, this.player.y));
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 6);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 6);
  }

  bulletWorld(ctx) {
    const G = this;
    return {
      ...ctx,
      player: this.player,
      enemies: this.missions.enemies,
      vehicles: allVehicles(this.traffic, this.parked, this.police, this.missions.missionCars),
      onPedHit(p, b) {
        if (p.state === 'dead') return;
        p.state = 'dead';
        p.deadTimer = 8;
        G.peds.scare(p.x, p.y, 300);
        if (b.from === 'player') {
          G.player.kills += 1;
          G.police.addHeat(WANTED.heatKillPed);
        }
      },
      onEnemyHit(e, b) {
        if (b.from !== 'player') return;
        e.hp -= b.damage;
        if (e.hp <= 0) {
          G.missions.onEnemyKilled(ctx);
          G.player.kills += 1;
          G.particles.addText(e.x, e.y - 30, 'Viper down', '#ff9a5a');
        }
      },
      onCopHit(c, b) {
        if (b.from !== 'player') return;
        c.hp -= b.damage;
        if (c.hp <= 0) {
          G.player.kills += 1;
          G.police.addHeat(WANTED.heatKillCop);
        }
      },
      onCarHit(v, b) {
        v.damage(4);
        if (v.destroyed) {
          G.particles.explosion(v.x, v.y);
          G.audio.explosion();
          G.peds.scare(v.x, v.y, 400);
          if (b.from === 'player') G.police.addHeat(9);
        }
      },
      onPlayerHit(damage) {
        G.player.takeDamage(damage, G.audio);
      },
    };
  }

  collideCars() {
    const playerCar = this.player.inCar;
    if (!playerCar) return;
    const others = [...this.traffic.cars, ...this.police.cruisers];
    for (const o of others) {
      if (o.destroyed) continue;
      const dx = playerCar.x - o.x; const dy = playerCar.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 68) {
        const push = (68 - d) * 0.5;
        playerCar.x += (dx / d) * push;
        playerCar.y += (dy / d) * push;
        o.x -= (dx / d) * push;
        o.y -= (dy / d) * push;
        const impact = Math.abs(playerCar.speed - o.speed);
        if (impact > 120) {
          playerCar.damage(impact * 0.03);
          o.damage(impact * 0.02);
          this.particles.sparks(playerCar.x, playerCar.y);
          this.audio.crash(Math.min(1, impact / 500));
          playerCar.speed *= 0.92;
          o.speed *= 0.92;
        }
      }
    }
  }

  collidePlayerWithTraffic() {
    if (this.player.inCar || this.player.dead) return;
    for (const c of this.traffic.cars) {
      if (c.destroyed) continue;
      if (pointInCar(c, this.player.x, this.player.y, 6) && Math.abs(c.speed) > 40) {
        const a = Math.atan2(this.player.y - c.y, this.player.x - c.x);
        this.player.takeDamage(18, this.audio);
        const pos = resolveCircle(this.city, this.player.x + Math.cos(a) * 40, this.player.y + Math.sin(a) * 40, 13);
        this.player.x = pos.x; this.player.y = pos.y;
        this.particles.blood(this.player.x, this.player.y);
        c.speed *= 0.6;
      }
    }
  }

  checkStashes() {
    for (const s of this.city.stashes) {
      if (s.taken) continue;
      if (Math.hypot(this.player.x - s.x, this.player.y - s.y) < 28) {
        s.taken = true;
        this.player.money += 100;
        this.particles.addText(s.x, s.y - 30, '+$100 stash', '#7dff8a');
        this.audio.cash();
      }
    }
  }

  handleMissionEvent(ev) {
    if (ev.type === 'missionComplete') {
      this.lastMission = ev.mission;
      this.screen = 'missionComplete';
      this.save.save(this);
    } else if (ev.type === 'missionFailed') {
      this.lastMission = ev.mission;
      this.failReason = ev.reason;
      this.screen = 'missionFailed';
    }
  }

  getWasted() {
    this.lastLoss = Math.round(this.player.money * ECONOMY.wastedLoss);
    this.player.money -= this.lastLoss;
    this.screen = 'wasted';
    this.audio.busted();
  }

  getBusted() {
    this.lastLoss = Math.round(this.player.money * ECONOMY.bustedLoss);
    this.player.money -= this.lastLoss;
    this.screen = 'busted';
    this.audio.busted();
  }

  // --- Render ---------------------------------------------------------------

  render() {
    this.renderer.draw(this);
    this.hud.draw(this);
  }

  // --- Menu clicks ----------------------------------------------------------

  handleClicks() {
    if (!this.input.mouse.clicked) return;
    const mx = this.input.mouse.x; const my = this.input.mouse.y;
    for (const b of this.hud.buttons) {
      if (!b.action) continue;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        this.audio.resume();
        this.audio.click();
        this.handleAction(b.action);
        return;
      }
    }
  }

  handleAction(action) {
    if (action === 'continue') this.continueGame();
    else if (action === 'newGame') this.newGame();
    else if (action === 'missions') { this.returnScreen = this.screen; this.screen = 'missions'; }
    else if (action === 'howto') { this.returnScreen = this.screen; this.screen = 'howto'; }
    else if (action === 'backToTitle') this.screen = 'title';
    else if (action === 'toggleSound') this.audio.setEnabled(!this.audio.enabled);
    else if (action === 'resume') this.screen = 'play';
    else if (action === 'saveGame') {
      if (this.save.save(this)) { this.saveMessage = 'Game saved.'; this.saveMessageTimer = 2; }
    } else if (action === 'restartMission') {
      if (this.missions.active) { const id = this.missions.current.id; this.missions.start(id, this); this.screen = 'play'; }
    } else if (action === 'quitToTitle') { this.missions.abort(); this.screen = 'title'; }
    else if (action === 'respawn') this.respawn(this.screen === 'wasted' ? 'hospital' : 'policeHQ');
    else if (action === 'retryMission') {
      if (this.lastMission) { this.missions.start(this.lastMission.id, this); this.screen = 'play'; }
    } else if (action.startsWith('startMission:')) {
      const id = Number(action.split(':')[1]);
      this.briefingMission = MISSIONS.find((m) => m.id === id) || null;
      this.returnScreen = 'missions';
      this.screen = 'briefing';
    } else if (action.startsWith('confirmMission:')) {
      const id = Number(action.split(':')[1]);
      this.missions.start(id, this);
      this.screen = 'play';
      this.audio.resume();
      this.audio.engineStart();
    } else if (action === 'cancelBriefing') {
      this.screen = this.returnScreen || 'title';
    }
  }
}

const canvas = document.getElementById('game');
new Game(canvas);
