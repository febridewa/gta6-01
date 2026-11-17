// Solmar Bay — everything the player sees: the city, the cars, the people,
// the effects and the golden-hour light. One clear job: draw the world.

import { WORLD, PALETTE } from './config.js';
import { isBeach, isOcean } from './city.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(G) {
    const ctx = this.ctx;
    const { camera, city, time } = G;
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    const view = {
      x0: camera.x - w / 2 / camera.zoom - 80,
      y0: camera.y - h / 2 / camera.zoom - 80,
      x1: camera.x + w / 2 / camera.zoom + 80,
      y1: camera.y + h / 2 / camera.zoom + 80,
    };
    this.drawGround(ctx, city, view, time);
    this.drawRoads(ctx, city, view);
    this.drawParks(ctx, city, view);
    this.drawPiers(ctx, city, view);
    this.drawBuildings(ctx, city, view);
    this.drawProps(ctx, city, view, time);
    this.drawStashes(ctx, G, view);
    this.drawMissionBeacon(ctx, G, view, time);
    this.drawSkids(ctx, G);
    this.drawVehicles(ctx, G, view, time);
    this.drawPeds(ctx, G, view, time);
    this.drawEnemies(ctx, G, view);
    this.drawCops(ctx, G, view, time);
    this.drawPlayer(ctx, G, view, time);
    this.drawBullets(ctx, G);
    this.drawParticles(ctx, G);
    ctx.restore();
    this.drawLighting(ctx, w, h, G);
    if (G.player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200,30,20,${G.player.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawGround(ctx, city, view, time) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    // Mow stripes on the grass blocks.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const startY = Math.floor(view.y0 / stripe) * stripe;
    for (let y = startY; y < view.y1; y += stripe * 2) {
      ctx.fillRect(Math.max(view.x0, 0), y, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), stripe);
    }
    // Beach and ocean.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(view.x0, 0), WORLD.beachTop, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), WORLD.oceanTop - WORLD.beachTop);
    ctx.fillStyle = PALETTE.sandWet;
    ctx.fillRect(Math.max(view.x0, 0), WORLD.oceanTop - 14, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), 14);
    ctx.fillStyle = PALETTE.ocean;
    ctx.fillRect(Math.max(view.x0, 0), WORLD.oceanTop, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), WORLD.height - WORLD.oceanTop);
    // Animated wave lines.
    ctx.strokeStyle = PALETTE.waterShine;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      const wy = WORLD.oceanTop + 26 + i * 64 + Math.sin(time * 0.8 + i * 1.7) * 6;
      if (wy < view.y0 || wy > view.y1) continue;
      ctx.beginPath();
      for (let x = Math.max(view.x0, 0); x <= Math.min(view.x1, WORLD.width); x += 48) {
        const yy = wy + Math.sin(x * 0.02 + time * 1.3 + i) * 4;
        if (x === Math.max(view.x0, 0)) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  drawRoads(ctx, city, view) {
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of city.avenues) {
      ctx.fillRect(ax - WORLD.roadWidth / 2 - 10, 0, WORLD.roadWidth + 20, WORLD.height);
    }
    for (const sy of city.streets) {
      ctx.fillRect(0, sy - WORLD.roadWidth / 2 - 10, WORLD.width, WORLD.roadWidth + 20);
    }
    ctx.fillStyle = PALETTE.road;
    for (const ax of city.avenues) {
      ctx.fillRect(ax - WORLD.roadWidth / 2, 0, WORLD.roadWidth, 2580);
    }
    for (const sy of city.streets) {
      ctx.fillRect(0, sy - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const ax of city.avenues) {
      for (let y = 170; y < 2550; y += 60) {
        if (Math.abs(y % 300) < 50) continue;
        ctx.fillRect(ax - 2, y, 4, 28);
      }
    }
    for (const sy of city.streets) {
      for (let x = 170; x < 3450; x += 60) {
        if (Math.abs(x % 300) < 50) continue;
        ctx.fillRect(x, sy - 2, 28, 4);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const ax of city.avenues) {
      for (const sy of city.streets) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(ax - 24 + i * 8, sy - WORLD.roadWidth / 2 - 8, 4, 10);
          ctx.fillRect(ax - 24 + i * 8, sy + WORLD.roadWidth / 2 - 2, 4, 10);
        }
      }
    }
  }

  drawParks(ctx, city, view) {
    for (const p of city.parks) {
      if (p.x > view.x1 || p.x + p.w < view.x0 || p.y > view.y1 || p.y + p.h < view.y0) continue;
      ctx.fillStyle = '#6d9e52';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = PALETTE.parkPath;
      ctx.fillRect(p.x + p.w / 2 - 6, p.y, 12, p.h);
      ctx.fillRect(p.x, p.y + p.h / 2 - 6, p.w, 12);
      // Pond.
      ctx.fillStyle = '#4a90b8';
      ctx.beginPath();
      ctx.ellipse(p.x + p.w * 0.28, p.y + p.h * 0.3, 26, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const lot of city.lots) {
      if (lot.x > view.x1 || lot.x + lot.w < view.x0 || lot.y > view.y1 || lot.y + lot.h < view.y0) continue;
      ctx.fillStyle = '#9a948a';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 20; x < lot.x + lot.w - 10; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, lot.y + 10); ctx.lineTo(x, lot.y + 44); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, lot.y + lot.h - 10); ctx.lineTo(x, lot.y + lot.h - 44); ctx.stroke();
      }
    }
  }

  drawPiers(ctx, city, view) {
    for (const p of city.piers) {
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#a8845c';
      for (let y = p.y; y < p.y + p.h; y += 18) ctx.fillRect(p.x, y, p.w, 3);
      // Lighthouse at the end.
      const lx = p.x + p.w / 2; const ly = p.y + p.h - 10;
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath(); ctx.arc(lx, ly, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c22e2e';
      ctx.beginPath(); ctx.arc(lx, ly, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawBuildings(ctx, city, view) {
    const list = city.buildings.filter((b) => b.x + b.w > view.x0 && b.x < view.x1 && b.y + b.h > view.y0 && b.y < view.y1);
    list.sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const b of list) {
      const lift = b.hgt * 0.32;
      // Drop shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10 + lift * 0.4, b.w, b.h);
      // South and east walls.
      ctx.fillStyle = '#5d5348';
      ctx.fillRect(b.x, b.y + lift, b.w, b.h - lift + 6);
      ctx.fillStyle = '#6d6156';
      ctx.fillRect(b.x + b.w - 8, b.y, 8, b.h);
      // Roof.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h - lift * 0.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - lift * 0.4 - 2);
      // Roof details: AC units and skylights.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 10, b.y + 10, 16, 12);
      ctx.fillRect(b.x + b.w - 30, b.y + b.h - lift * 0.4 - 26, 18, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + 8, 24, 10);
      // Windows on the tall ones.
      if (b.hgt > 30) {
        ctx.fillStyle = 'rgba(255,240,180,0.5)';
        for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 18) {
          ctx.fillRect(wx, b.y + b.h - lift * 0.4 - 8, 8, 4);
        }
      }
    }
  }

  drawProps(ctx, city, view, time) {
    for (const t of city.trees) {
      if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.75, 0, Math.PI * 2); ctx.fill();
    }
    for (const l of city.lamps) {
      if (l.x < view.x0 || l.x > view.x1 || l.y < view.y0 || l.y > view.y1) continue;
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
      ctx.fillStyle = 'rgba(255,230,150,0.7)';
      ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawStashes(ctx, G, view) {
    for (const s of G.city.stashes) {
      if (s.taken) continue;
      if (s.x < view.x0 || s.x > view.x1 || s.y < view.y0 || s.y > view.y1) continue;
      const bob = Math.sin(G.time * 3 + s.id) * 3;
      ctx.fillStyle = '#2e7a3a';
      ctx.beginPath(); ctx.arc(s.x, s.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', s.x, s.y + bob);
    }
  }

  drawMissionBeacon(ctx, G, view, time) {
    const target = G.missions.stepTarget();
    if (!target || !G.missions.active) return;
    const pulse = 0.5 + Math.sin(time * 4) * 0.25;
    const grad = ctx.createLinearGradient(target.x, target.y - 160, target.x, target.y);
    grad.addColorStop(0, 'rgba(255,220,60,0)');
    grad.addColorStop(1, `rgba(255,220,60,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 16, target.y - 160, 32, 160);
    ctx.fillStyle = '#ffd83c';
    ctx.beginPath(); ctx.arc(target.x, target.y, 10 + Math.sin(time * 4) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5c00';
    ctx.beginPath(); ctx.arc(target.x, target.y, 5, 0, Math.PI * 2); ctx.fill();
    // Off-screen arrow toward the objective.
    const w = this.canvas.clientWidth; const h = this.canvas.clientHeight;
    const sx = (target.x - G.camera.x) * G.camera.zoom + w / 2;
    const sy = (target.y - G.camera.y) * G.camera.zoom + h / 2;
    if (sx < 60 || sx > w - 60 || sy < 60 || sy > h - 60) {
      const cx = Math.max(70, Math.min(w - 70, sx));
      const cy = Math.max(70, Math.min(h - 70, sy));
      const a = Math.atan2(sy - h / 2, sx - w / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd83c';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  drawSkids(ctx, G) {
    ctx.strokeStyle = 'rgba(20,20,20,0.35)';
    ctx.lineWidth = 4;
    for (const s of G.particles.skids) {
      ctx.globalAlpha = Math.min(1, s.life / 3);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * s.len / 2, s.y - Math.sin(s.angle) * s.len / 2);
      ctx.lineTo(s.x + Math.cos(s.angle) * s.len / 2, s.y + Math.sin(s.angle) * s.len / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawCar(ctx, v, time, isPlayer) {
    ctx.save();
    ctx.translate(v.x, v.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 5, v.def.len / 2, v.def.wid / 2, v.angle, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(v.angle);
    const w = v.def.len; const h = v.def.wid;
    // Body.
    ctx.fillStyle = v.color;
    roundRect(ctx, -w / 2, -h / 2, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Windows and roof.
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    roundRect(ctx, w * 0.08, -h / 2 + 4, w * 0.22, h - 8, 4); ctx.fill();
    ctx.fillStyle = '#2c2c30';
    roundRect(ctx, -w * 0.05, -h / 2 + 5, w * 0.28, h - 10, 5); ctx.fill();
    // Windshield shine.
    ctx.fillStyle = 'rgba(180,220,255,0.35)';
    ctx.fillRect(w * 0.16, -h / 2 + 6, 5, h - 12);
    // Headlights and taillights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 6);
    ctx.fillRect(w / 2 - 2, h / 2 - 9, 3, 6);
    ctx.fillStyle = '#c22e2e';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 3, 3, 6);
    ctx.fillRect(-w / 2 - 1, h / 2 - 9, 3, 6);
    if (v.defName === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-w * 0.05, -h / 2, w * 0.28, h);
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPD', 0, 3);
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect(-4, -h / 2 - 3, 8, 4);
      ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
      ctx.fillRect(-4, h / 2 - 1, 8, 4);
    }
    if (v.defName === 'taxi') {
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
      ctx.fillStyle = '#20242c';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 2, w - 8, 3);
    }
    if (v.defName === 'truck') {
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(-w / 2 + 6, -h / 2 + 4, w * 0.42, h - 8);
    }
    // Damage smoke is handled by particles; show a dent when hurt.
    if (v.hp < v.maxHp * 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(w / 2 - 10, -h / 4, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(v.x, v.y, v.def.len / 2 + 8, v.def.wid / 2 + 8, v.angle, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawVehicles(ctx, G, view, time) {
    const all = [
      ...G.traffic.cars, ...G.parked,
      ...G.police.cruisers, ...G.missions.missionCars,
    ];
    for (const v of all) {
      if (v.destroyed) continue;
      if (v.x < view.x0 || v.x > view.x1 || v.y < view.y0 || v.y > view.y1) continue;
      this.drawCar(ctx, v, time, G.player.inCar === v);
    }
  }

  drawPerson(ctx, x, y, angle, shirt, skin, opts) {
    const o = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    if (o.dead) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(12, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      const bob = o.walking ? Math.sin(o.bob || 0) * 1.5 : 0;
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(7 + bob, 0, 5.5, 0, Math.PI * 2); ctx.fill();
      if (o.gun) {
        ctx.fillStyle = '#222';
        ctx.fillRect(8, -2, 12, 3);
      }
      if (o.cop) {
        ctx.fillStyle = '#20242c';
        ctx.beginPath(); ctx.arc(-2, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath(); ctx.arc(7, 0, 5.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    if (o.marker) {
      ctx.fillStyle = o.marker;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(o.markerText || '!', x, y - 22);
    }
  }

  drawPeds(ctx, G, view, time) {
    for (const p of G.peds.list) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const marker = G.peds.fare && G.peds.fare.ped === p && G.peds.fare.state === 'waiting';
      this.drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.skin, {
        dead: p.state === 'dead',
        walking: p.state === 'walk' || p.state === 'flee',
        bob: time * 8 + p.x,
        marker: marker ? '#ffe95a' : null,
        markerText: '$',
      });
    }
  }

  drawEnemies(ctx, G, view) {
    for (const e of G.missions.enemies) {
      if (e.x < view.x0 || e.x > view.x1 || e.y < view.y0 || e.y > view.y1) continue;
      this.drawPerson(ctx, e.x, e.y, e.angle, '#7a1e1e', '#c98a5a', { gun: true, walking: true, bob: G.time * 8 + e.x });
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 14, e.y - 24, 28, 4);
      ctx.fillStyle = '#ff4a3a';
      ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 100), 4);
    }
  }

  drawCops(ctx, G, view, time) {
    for (const c of G.police.footCops) {
      if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
      this.drawPerson(ctx, c.x, c.y, c.angle, '#20242c', '#e8b88a', { cop: true, gun: true, walking: true, bob: time * 9 + c.x });
    }
  }

  drawPlayer(ctx, G, view, time) {
    const p = G.player;
    if (p.dead || p.inCar) return;
    if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) return;
    this.drawPerson(ctx, p.x, p.y, p.angle, '#1f8a4c', '#e8b88a', { gun: true, walking: p.moving, bob: time * 10 });
    // Aim line, faint.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
    ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46);
    ctx.stroke();
  }

  drawBullets(ctx, G) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    for (const b of G.bullets.list) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawParticles(ctx, G) {
    for (const p of G.particles.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of G.particles.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  drawLighting(ctx, w, h, G) {
    // Golden-hour wash and a soft vignette.
    const grad = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(255,196,110,0.05)');
    grad.addColorStop(1, 'rgba(40,20,60,0.20)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}
