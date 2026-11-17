// Solmar Bay — the player: Mara Solis, on foot and behind the wheel.
// One clear job: move, drive, shoot, steal, pay and get hurt.

import { PLAYER_TUNING, WEAPONS, WANTED, ECONOMY } from './config.js';
import { resolveCircle } from './city.js';
import { nearestCar, pointInCar } from './vehicles.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.hp = PLAYER_TUNING.maxHp;
    this.armor = 0;
    this.money = ECONOMY.startMoney;
    this.inCar = null;
    this.weapon = 'pistol';
    this.ammo = WEAPONS.pistol.mag;
    this.reserve = Infinity;
    this.reloadTimer = 0;
    this.shootTimer = 0;
    this.speed = 0;
    this.moving = false;
    this.hurtFlash = 0;
    this.dead = false;
    this.carsStolen = 0;
    this.kills = 0;
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.hp = PLAYER_TUNING.maxHp;
    this.armor = 0;
    this.inCar = null;
    this.ammo = WEAPONS.pistol.mag;
    this.reloadTimer = 0;
    this.dead = false;
    this.hurtFlash = 0;
  }

  takeDamage(amount, audio) {
    if (this.dead) return;
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.6);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.hp -= rest;
    this.hurtFlash = 0.35;
    if (audio) audio.hit();
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  update(dt, input, ctx) {
    const { city, audio, particles, bullets, police, peds, traffic, parked } = ctx;
    if (this.dead) return;
    this.shootTimer -= dt;
    this.reloadTimer -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    const vehicles = [...traffic.cars, ...parked, ...police.cruisers, ...ctx.missionCars];

    if (this.inCar) {
      const car = this.inCar;
      if (car.destroyed) {
        this.exitCar(ctx, true);
      } else {
        const ax = input.axis();
        const throttle = ax.y < 0 ? 1 : (ax.y > 0 ? -1 : 0);
        const steer = ax.x;
        const handbrake = input.down('Space');
        const before = car.speed;
        const hit = car.drive(dt, throttle, steer, handbrake, city);
        if (hit && Math.abs(before) > 200) {
          audio.crash(Math.min(1, Math.abs(before) / 500));
          particles.sparks(car.x + Math.cos(car.angle) * 30, car.y + Math.sin(car.angle) * 30);
          this.takeDamage(2, null);
        }
        if (handbrake && Math.abs(car.speed) > 150 && Math.random() < dt * 20) {
          particles.addSkid(car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30, car.angle, 16);
        }
        if (car.hp < 45 && Math.random() < dt * 3) particles.smoke(car.x, car.y, false);
        this.x = car.x; this.y = car.y;
        this.angle = car.angle;
        this.speed = car.speed;
        this.moving = Math.abs(car.speed) > 20;
        audio.engineUpdate(Math.abs(car.speed) / car.def.maxSpeed, true);
        if (input.wasPressed('KeyE')) this.exitCar(ctx, false);
        if (input.wasPressed('KeyR')) { /* no reload while driving */ }
      }
      return;
    }

    // On foot.
    const ax = input.axis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? PLAYER_TUNING.sprintSpeed : PLAYER_TUNING.walkSpeed;
    const len = Math.hypot(ax.x, ax.y) || 1;
    this.moving = ax.x !== 0 || ax.y !== 0;
    if (this.moving) {
      const nx = this.x + (ax.x / len) * speed * dt;
      const ny = this.y + (ax.y / len) * speed * dt;
      const pos = resolveCircle(city, nx, ny, PLAYER_TUNING.radius);
      this.x = pos.x; this.y = pos.y;
      this.speed = speed;
    } else {
      this.speed = 0;
    }
    // Aim at the mouse.
    this.angle = Math.atan2(input.mouse.worldY - this.y, input.mouse.worldX - this.x);
    audio.engineUpdate(0, false);

    // Shoot.
    if (input.mouse.down && this.shootTimer <= 0 && this.reloadTimer <= 0) {
      if (this.ammo > 0) {
        this.shootTimer = WEAPONS.pistol.rate;
        this.ammo -= 1;
        const mx = this.x + Math.cos(this.angle) * 20;
        const my = this.y + Math.sin(this.angle) * 20;
        bullets.fire(mx, my, this.angle, 'player');
        particles.muzzle(mx, my, this.angle);
        audio.shoot();
        police.addHeat(WANTED.heatShot);
        peds.scare(this.x, this.y, 420);
      } else {
        this.shootTimer = 0.25;
        audio.click();
      }
    }
    if ((input.wasPressed('KeyR') || this.ammo === 0) && this.reloadTimer <= 0 && this.ammo < WEAPONS.pistol.mag) {
      this.reloadTimer = WEAPONS.pistol.reload;
      this.ammo = WEAPONS.pistol.mag;
      audio.click();
    }

    // Enter a car.
    if (input.wasPressed('KeyE')) {
      const car = nearestCar(vehicles, this.x, this.y, 85);
      if (car) this.enterCar(car, ctx);
    }
  }

  enterCar(car, ctx) {
    const { police, audio, particles, peds } = ctx;
    if (car.driver === 'traffic') {
      // Pull the driver out and steal it.
      car.driver = 'player';
      this.carsStolen += 1;
      police.addHeat(WANTED.heatStealCar);
      particles.addText(this.x, this.y - 34, 'Car stolen!', '#ff9a5a');
      // The pulled-out driver flees on foot.
      const driver = peds.spawnPedAt(this.x + 30, this.y + 10);
      if (driver) { driver.state = 'flee'; driver.fleeTimer = 3; driver.angle = Math.atan2(this.y - driver.y, this.x - driver.x) + Math.PI; }
    } else if (car.driver === 'police') {
      particles.addText(this.x, this.y - 34, 'Locked!', '#ff6a5a');
      audio.click();
      return;
    } else {
      car.driver = 'player';
    }
    this.inCar = car;
    audio.door();
    audio.engineStart();
  }

  exitCar(ctx, forced) {
    const car = this.inCar;
    if (!car) return;
    car.driver = null;
    this.inCar = null;
    const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
    const pos = resolveCircle(ctx.city, side.x, side.y, PLAYER_TUNING.radius);
    this.x = pos.x; this.y = pos.y;
    this.speed = 0;
    if (!forced) ctx.audio.door();
  }
}
