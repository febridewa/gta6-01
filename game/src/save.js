// Solmar Bay — saving to localStorage, so Mara's money, missions and
// stashes survive a closed tab. One clear job: persist and restore progress.

import { SAVE_KEY } from './config.js';

export class SaveManager {
  constructor() {
    this.exists = false;
    this.data = null;
    this.load();
  }

  load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) { this.exists = false; this.data = null; return null; }
      this.data = JSON.parse(raw);
      this.exists = true;
      return this.data;
    } catch (e) {
      this.exists = false;
      this.data = null;
      return null;
    }
  }

  save(G) {
    const data = {
      version: 1,
      money: G.player.money,
      hp: G.player.hp,
      armor: G.player.armor,
      px: G.player.x,
      py: G.player.y,
      missionsDone: [...G.missions.completed],
      stashesTaken: G.city.stashes.filter((s) => s.taken).map((s) => s.id),
      carsStolen: G.player.carsStolen,
      kills: G.player.kills,
      sound: G.audio.enabled,
      music: G.audio.musicOn,
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.data = data;
      this.exists = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  apply(G) {
    const d = this.data;
    if (!d) return false;
    G.player.money = d.money ?? 120;
    G.player.hp = d.hp ?? 100;
    G.player.armor = d.armor ?? 0;
    G.player.x = d.px ?? 1050;
    G.player.y = d.py ?? 750;
    G.missions.completed = new Set(d.missionsDone || []);
    for (const id of d.stashesTaken || []) {
      const s = G.city.stashes.find((x) => x.id === id);
      if (s) s.taken = true;
    }
    G.player.carsStolen = d.carsStolen || 0;
    G.player.kills = d.kills || 0;
    if (d.sound !== undefined) G.audio.setEnabled(d.sound);
    if (d.music !== undefined) G.audio.setMusic(d.music);
    return true;
  }

  clear() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.exists = false;
    this.data = null;
  }
}
