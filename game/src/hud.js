// Solmar Bay — the HUD, the minimap and every menu screen.
// One clear job: show the player what matters and take their choices.

import { MISSIONS } from './missions.js';
import { WORLD } from './config.js';

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12,14,20,${alpha === undefined ? 0.62 : alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export class Hud {
  constructor() {
    this.buttons = [];
  }

  clearButtons() { this.buttons = []; }

  button(ctx, x, y, w, h, label, opts) {
    const o = opts || {};
    const hover = o.hover;
    ctx.fillStyle = o.primary ? '#e8a33a' : (hover ? '#3a4152' : '#232833');
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = o.primary ? '#ffd83c' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = o.primary ? '#1a1206' : '#f2f2f2';
    ctx.font = `bold ${o.size || 17}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    this.buttons.push({ x, y, w, h, action: o.action, label });
  }

  draw(G) {
    const ctx = G.renderer.ctx;
    const w = G.canvas.clientWidth;
    const h = G.canvas.clientHeight;
    this.clearButtons();
    const screen = G.screen;
    if (screen === 'title') this.drawTitle(G, ctx, w, h);
    else if (screen === 'missions') this.drawMissions(G, ctx, w, h);
    else if (screen === 'howto') this.drawHowTo(G, ctx, w, h);
    else if (screen === 'pause') { this.drawHud(G, ctx, w, h); this.drawPause(G, ctx, w, h); }
    else if (screen === 'briefing') { this.drawHud(G, ctx, w, h); this.drawBriefing(G, ctx, w, h); }
    else if (screen === 'wasted' || screen === 'busted') { this.drawHud(G, ctx, w, h); this.drawEnd(G, ctx, w, h); }
    else if (screen === 'missionComplete') { this.drawHud(G, ctx, w, h); this.drawMissionComplete(G, ctx, w, h); }
    else if (screen === 'missionFailed') { this.drawHud(G, ctx, w, h); this.drawMissionFailed(G, ctx, w, h); }
    else this.drawHud(G, ctx, w, h);
  }

  // --- In-game HUD ---------------------------------------------------------

  drawHud(G, ctx, w, h) {
    const { player, police, missions } = G;
    // Mission card, top-left.
    if (missions.active) {
      const step = missions.step;
      panel(ctx, 14, 14, 340, 66, 0.66);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffd83c';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(missions.current.title.toUpperCase(), 28, 38);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      let label = step ? step.label : '';
      if (step && step.type === 'kill') label = label.replace(/\(\d+\/\d+\)/, `(${missions.kills}/${step.count})`);
      ctx.fillText(label, 28, 60);
      if (step && step.time && (step.type === 'deliver' || step.type === 'goto')) {
        ctx.fillStyle = missions.stepTimer < 15 ? '#ff6a5a' : '#7dff8a';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(`${Math.ceil(missions.stepTimer)}s`, 320, 38);
      }
    } else {
      panel(ctx, 14, 14, 300, 40, 0.55);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Free roam — press M for missions', 28, 40);
    }

    // Wanted stars + money, top-right.
    const stars = police.stars();
    panel(ctx, w - 250, 14, 236, 66, 0.66);
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px sans-serif';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? '#ffd83c' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', w - 40 - i * 30, 46);
    }
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`$${player.money.toLocaleString('en-US')}`, w - 28, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText('SOLMAR BAY', w - 28, 26);

    // Minimap, bottom-left.
    this.drawMinimap(G, ctx, 16, h - 166);

    // Health / armour / weapon, bottom-right.
    panel(ctx, w - 250, h - 96, 236, 82, 0.66);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HEALTH', w - 236, h - 72);
    ctx.fillStyle = '#222';
    ctx.fillRect(w - 236, h - 66, 150, 10);
    ctx.fillStyle = player.hp > 30 ? '#4fd94f' : '#ff4a3a';
    ctx.fillRect(w - 236, h - 66, 150 * Math.max(0, player.hp / 100), 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ARMOUR', w - 236, h - 44);
    ctx.fillStyle = '#222';
    ctx.fillRect(w - 236, h - 38, 150, 10);
    ctx.fillStyle = '#6ab8ff';
    ctx.fillRect(w - 236, h - 38, 150 * Math.max(0, player.armor / 100), 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    const weapon = player.inCar ? 'DRIVING' : `P9  ${player.ammo}/12`;
    ctx.fillText(weapon, w - 28, h - 62);
    if (player.inCar) {
      const kmh = Math.round(Math.abs(player.inCar.speed) * 0.24);
      ctx.fillStyle = '#ffd83c';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`${kmh} km/h`, w - 28, h - 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText(player.inCar.def.name, w - 28, h - 18);
    }

    // Context prompt, bottom-centre.
    const prompt = this.contextPrompt(G);
    if (prompt) {
      ctx.font = 'bold 15px sans-serif';
      const tw = ctx.measureText(prompt).width + 28;
      panel(ctx, w / 2 - tw / 2, h - 52, tw, 34, 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(prompt, w / 2, h - 30);
    }

    // Crosshair on foot.
    if (!player.inCar && !player.dead) {
      const m = G.input.mouse;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 13, m.y); ctx.lineTo(m.x - 5, m.y);
      ctx.moveTo(m.x + 5, m.y); ctx.lineTo(m.x + 13, m.y);
      ctx.moveTo(m.x, m.y - 13); ctx.lineTo(m.x, m.y - 5);
      ctx.moveTo(m.x, m.y + 5); ctx.lineTo(m.x, m.y + 13);
      ctx.stroke();
    }

    // Mission message toast.
    if (missions.message && missions.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, missions.messageTimer);
      ctx.font = 'bold 20px sans-serif';
      const tw = ctx.measureText(missions.message).width + 36;
      panel(ctx, w / 2 - tw / 2, 100, tw, 42, 0.75);
      ctx.fillStyle = '#ffd83c';
      ctx.textAlign = 'center';
      ctx.fillText(missions.message, w / 2, 128);
      ctx.globalAlpha = 1;
    }

    // Reload indicator.
    if (player.reloadTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RELOADING…', w / 2, h - 70);
    }
  }

  contextPrompt(G) {
    const { player } = G;
    if (player.inCar) return 'E — Exit car    Space — Handbrake';
    // Near a car?
    const vehicles = [...G.traffic.cars, ...G.parked, ...G.police.cruisers, ...G.missions.missionCars];
    for (const v of vehicles) {
      if (v.destroyed) continue;
      if (Math.hypot(v.x - player.x, v.y - player.y) < 85) {
        if (v.driver === 'traffic') return `E — Steal the ${v.def.name}`;
        if (v.driver === 'police') return 'E — Enter (locked)';
        return `E — Enter the ${v.def.name}`;
      }
    }
    if (G.peds.fare && G.peds.fare.state === 'waiting' && Math.hypot(G.peds.fare.ped.x - player.x, G.peds.fare.ped.y - player.y) < 120) {
      return 'Drive up to the fare to pick them up';
    }
    return null;
  }

  drawMinimap(G, ctx, x, y) {
    const mw = 180; const mh = 150;
    const sx = mw / WORLD.width; const sy = mh / WORLD.height;
    panel(ctx, x - 6, y - 6, mw + 12, mh + 12, 0.66);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, mw, mh); ctx.clip();
    ctx.fillStyle = '#2a4a3a';
    ctx.fillRect(x, y, mw, mh);
    // Ocean.
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(x, y + WORLD.beachTop * sy, mw, mh - WORLD.beachTop * sy);
    // Roads.
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 2;
    for (const ax of G.city.avenues) {
      ctx.beginPath(); ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + 2550 * sy); ctx.stroke();
    }
    for (const sy2 of G.city.streets) {
      ctx.beginPath(); ctx.moveTo(x, y + sy2 * sy); ctx.lineTo(x + mw, y + sy2 * sy); ctx.stroke();
    }
    // Mission target.
    const target = G.missions.stepTarget();
    if (target && G.missions.active) {
      ctx.fillStyle = '#ffd83c';
      ctx.beginPath(); ctx.arc(x + target.x * sx, y + target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Fare.
    if (G.peds.fare && G.peds.fare.state === 'waiting') {
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', x + G.peds.fare.ped.x * sx, y + G.peds.fare.ped.y * sy);
    }
    // Police.
    for (const c of G.police.cruisers) {
      ctx.fillStyle = '#4a9aff';
      ctx.beginPath(); ctx.arc(x + c.x * sx, y + c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const c of G.police.footCops) {
      ctx.fillStyle = '#4a9aff';
      ctx.fillRect(x + c.x * sx - 2, y + c.y * sy - 2, 4, 4);
    }
    // Player arrow.
    const px = x + G.player.x * sx; const py = y + G.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(G.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', x + 2, y + mh + 9);
  }

  // --- Menus ---------------------------------------------------------------

  drawTitle(G, ctx, w, h) {
    ctx.fillStyle = 'rgba(10,12,24,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd83c';
    ctx.font = 'bold 84px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('SOLMAR BAY', w / 2, h / 2 - 120);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('An open-world crime story', w / 2, h / 2 - 82);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText('Steal cars. Outrun the SPD. Take the bay.', w / 2, h / 2 - 52);
    const bw = 280; const bh = 48; const bx = w / 2 - bw / 2;
    let by = h / 2 - 8;
    if (G.save.exists) { this.button(ctx, bx, by, bw, bh, 'Continue', { action: 'continue', primary: true }); by += 60; }
    this.button(ctx, bx, by, bw, bh, 'New Game', { action: 'newGame', primary: !G.save.exists }); by += 60;
    this.button(ctx, bx, by, bw, bh, 'Missions', { action: 'missions' }); by += 60;
    this.button(ctx, bx, by, bw, bh, 'How to Play', { action: 'howto' }); by += 60;
    this.button(ctx, bx, by, bw, bh, G.audio.enabled ? 'Sound: On' : 'Sound: Off', { action: 'toggleSound' });
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move · Mouse aim · Click shoot · E enter car · Esc pause · M mute', w / 2, h - 24);
  }

  drawMissions(G, ctx, w, h) {
    ctx.fillStyle = 'rgba(10,12,24,0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd83c';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('MISSIONS', w / 2, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText('Mara Solis and the fight for Solmar Bay', w / 2, 118);
    const bw = 560; const bh = 52;
    const bx = w / 2 - bw / 2;
    let by = 150;
    for (const m of MISSIONS) {
      const done = G.missions.completed.has(m.id);
      const unlocked = m.id === 1 || G.missions.completed.has(m.id - 1);
      const label = `${m.id}. ${m.title} — ${m.giver}  ·  $${m.reward}  ·  ${done ? 'DONE' : (unlocked ? 'AVAILABLE' : 'LOCKED')}`;
      this.button(ctx, bx, by, bw, bh, label, {
        action: unlocked ? `startMission:${m.id}` : null,
        primary: false,
        size: 15,
      });
      by += 62;
    }
    this.button(ctx, w / 2 - 110, by + 6, 220, 46, 'Back', { action: 'backToTitle' });
  }

  drawHowTo(G, ctx, w, h) {
    ctx.fillStyle = 'rgba(10,12,24,0.78)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd83c';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('HOW TO PLAY', w / 2, 90);
    const lines = [
      'WASD / Arrows — move on foot, drive when in a car',
      'Mouse — aim    Left click — shoot    R — reload',
      'E — enter / steal a car, exit a car',
      'Shift — sprint    Space — handbrake',
      'Esc — pause    M — mute music    F — save game',
      '',
      'Steal cars, take taxi fares and grab cash stashes ($100).',
      'Missions pay the big money. Heat brings the SPD: 1 star is a',
      'cruiser, 5 stars is the whole department. Lose them by hiding',
      'out of sight, or get busted and lose 12% of your cash.',
      'Getting wasted costs 10%. The bay is yours — take it.',
    ];
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, w / 2, 150 + i * 30));
    this.button(ctx, w / 2 - 110, 150 + lines.length * 30 + 10, 220, 46, 'Back', { action: 'backToTitle' });
  }

  drawPause(G, ctx, w, h) {
    ctx.fillStyle = 'rgba(10,12,24,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd83c';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', w / 2, h / 2 - 130);
    const bw = 280; const bh = 48; const bx = w / 2 - bw / 2;
    let by = h / 2 - 80;
    this.button(ctx, bx, by, bw, bh, 'Resume', { action: 'resume', primary: true }); by += 60;
    this.button(ctx, bx, by, bw, bh, 'Save Game', { action: 'saveGame' }); by += 60;
    if (G.missions.active) { this.button(ctx, bx, by, bw, bh, 'Restart Mission', { action: 'restartMission' }); by += 60; }
    this.button(ctx, bx, by, bw, bh, G.audio.enabled ? 'Sound: On' : 'Sound: Off', { action: 'toggleSound' }); by += 60;
    this.button(ctx, bx, by, bw, bh, 'Quit to Title', { action: 'quitToTitle' });
    if (G.saveMessage) {
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(G.saveMessage, w / 2, by + 40);
    }
  }

  drawBriefing(G, ctx, w, h) {
    const m = G.briefingMission;
    if (!m) return;
    ctx.fillStyle = 'rgba(10,12,24,0.66)';
    ctx.fillRect(0, 0, w, h);
    panel(ctx, w / 2 - 320, h / 2 - 190, 640, 380, 0.92);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd83c';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(m.title.toUpperCase(), w / 2, h / 2 - 140);
    ctx.fillStyle = '#ffd9a0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`From ${m.giver}  ·  Reward $${m.reward}`, w / 2, h / 2 - 108);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    const words = m.brief.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 62) { lines.push(line.trim()); line = word; } else line += ' ' + word;
    }
    lines.push(line.trim());
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 - 70 + i * 26));
    const by = h / 2 + 90;
    this.button(ctx, w / 2 - 290, by, 280, 50, 'Start Mission', { action: `confirmMission:${m.id}`, primary: true });
    this.button(ctx, w / 2 + 10, by, 280, 50, 'Not Yet', { action: 'cancelBriefing' });
  }

  drawEnd(G, ctx, w, h) {
    const wasted = G.screen === 'wasted';
    ctx.fillStyle = wasted ? 'rgba(60,8,8,0.62)' : 'rgba(8,16,60,0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = wasted ? '#ff5a4a' : '#6ab8ff';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(wasted ? 'WASTED' : 'BUSTED', w / 2, h / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px sans-serif';
    ctx.fillText(wasted ? 'The bay chewed you up. St. Anselm patched you together.' : 'The SPD took you in. You lost some cash and your freedom — briefly.', w / 2, h / 2);
    ctx.fillText(`You lost $${G.lastLoss}.`, w / 2, h / 2 + 30);
    this.button(ctx, w / 2 - 140, h / 2 + 60, 280, 50, 'Back on the Street', { action: 'respawn', primary: true });
  }

  drawMissionComplete(G, ctx, w, h) {
    const m = G.lastMission;
    ctx.fillStyle = 'rgba(10,12,24,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('MISSION COMPLETE', w / 2, h / 2 - 60);
    if (m) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.fillText(`${m.title}  ·  +$${m.reward}`, w / 2, h / 2 - 16);
    }
    this.button(ctx, w / 2 - 140, h / 2 + 20, 280, 50, 'Keep Playing', { action: 'resume', primary: true });
  }

  drawMissionFailed(G, ctx, w, h) {
    ctx.fillStyle = 'rgba(10,12,24,0.66)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6a5a';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('MISSION FAILED', w / 2, h / 2 - 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(G.failReason || 'The job fell apart.', w / 2, h / 2 - 16);
    this.button(ctx, w / 2 - 290, h / 2 + 20, 280, 50, 'Retry Mission', { action: 'retryMission', primary: true });
    this.button(ctx, w / 2 + 10, h / 2 + 20, 280, 50, 'Free Roam', { action: 'resume' });
  }
}
