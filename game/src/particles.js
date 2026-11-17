// Solmar Bay — particles, skid marks, floating text and shockwaves.
// One clear job: every visual effect that is born, lives briefly and dies.

export class Particles {
  constructor() {
    this.list = [];
    this.skids = [];
    this.texts = [];
  }

  spawn(x, y, opts) {
    const o = opts || {};
    const n = o.count || 8;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed || 120) * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp + (o.vx || 0),
        vy: Math.sin(a) * sp + (o.vy || 0),
        life: o.life || 0.5,
        maxLife: o.life || 0.5,
        size: (o.size || 3) * (0.6 + Math.random() * 0.8),
        color: o.color || '#ffcc66',
        gravity: o.gravity || 0,
        drag: o.drag || 0.9,
      });
    }
    if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
  }

  smoke(x, y, big) {
    this.spawn(x, y, { count: big ? 10 : 4, speed: 40, life: big ? 1.2 : 0.7, size: big ? 9 : 6, color: '#8a8a8a', drag: 0.94 });
  }

  sparks(x, y) { this.spawn(x, y, { count: 12, speed: 260, life: 0.35, size: 2.5, color: '#ffd76a' }); }

  blood(x, y) { this.spawn(x, y, { count: 10, speed: 150, life: 0.5, size: 3, color: '#a02020', gravity: 200 }); }

  muzzle(x, y, angle) {
    this.spawn(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16, {
      count: 4, speed: 200, life: 0.08, size: 3, color: '#ffe9a8', vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120,
    });
  }

  explosion(x, y) {
    this.spawn(x, y, { count: 40, speed: 320, life: 0.8, size: 6, color: '#ff7a2a', gravity: -60 });
    this.spawn(x, y, { count: 24, speed: 180, life: 1.1, size: 8, color: '#555555', drag: 0.95 });
    this.spawn(x, y, { count: 16, speed: 420, life: 0.4, size: 3, color: '#ffe9a8' });
  }

  addSkid(x, y, angle, len) {
    this.skids.push({ x, y, angle, len: len || 14, life: 6 });
    if (this.skids.length > 400) this.skids.shift();
  }

  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color: color || '#ffffff', life: 1.6, maxLife: 1.6 });
    if (this.texts.length > 24) this.texts.shift();
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.skids.length - 1; i >= 0; i -= 1) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 28 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }
}
