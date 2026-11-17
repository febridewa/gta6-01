// Solmar Bay — all sound is synthesized live with WebAudio: engine hum,
// gunshots, sirens, pickups and a small procedural music loop.
// One clear job: make noise without loading a single audio file.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = true;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? 0.5 : 0; }
  setMusic(on) { this.musicOn = on; }

  noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq, type) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  shoot() { this.noise(0.14, 0.5, 900); this.blip(180, 0.1, 'square', 0.18, 60); }
  enemyShoot() { this.noise(0.12, 0.22, 700); }
  hit() { this.blip(320, 0.08, 'triangle', 0.25, 180); }
  pickup() { this.blip(660, 0.09, 'sine', 0.22); setTimeout(() => this.blip(990, 0.14, 'sine', 0.22), 80); }
  cash() { this.blip(880, 0.08, 'sine', 0.2); setTimeout(() => this.blip(1320, 0.16, 'sine', 0.2), 70); }
  click() { this.blip(520, 0.05, 'square', 0.12); }
  door() { this.noise(0.12, 0.2, 500); this.blip(140, 0.08, 'sine', 0.15, 90); }
  crash(intensity) { this.noise(0.25, 0.25 + intensity * 0.3, 600); }
  explosion() { this.noise(0.7, 0.7, 300); this.blip(90, 0.5, 'sine', 0.4, 40); }
  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 110));
  }
  missionFail() {
    const notes = [392, 330, 262];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.12), i * 140));
  }
  busted() { this.blip(220, 0.5, 'sawtooth', 0.15, 110); }

  engineStart() {
    if (!this.ctx || this.engineOsc) return;
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  engineUpdate(speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const target = driving && this.enabled ? 0.05 + speedRatio * 0.10 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130, this.ctx.currentTime, 0.08);
  }

  sirenUpdate(active, dt) {
    if (!this.ctx) return;
    if (active && this.enabled) {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.sirenTimer = 0;
      }
      this.sirenTimer += dt;
      const phase = Math.floor(this.sirenTimer / 0.45) % 2;
      this.sirenOsc.frequency.setTargetAtTime(phase ? 950 : 700, this.ctx.currentTime, 0.05);
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // A slow Am–F–C–G pad loop with a soft bass, scheduled a step at a time.
  startMusic() {
    if (this.musicTimer) return;
    const chords = [
      [220.0, 261.6, 329.6], [174.6, 220.0, 261.6],
      [261.6, 329.6, 392.0], [196.0, 246.9, 293.7],
    ];
    const bass = [110.0, 87.3, 130.8, 98.0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn || !this.enabled) return;
      const step = this.musicStep;
      this.musicStep = (this.musicStep + 1) % 4;
      const chord = chords[step];
      const t = this.ctx.currentTime + 0.05;
      for (const f of chord) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.035, t + 0.4);
        gain.gain.linearRampToValueAtTime(0.0001, t + 2.4);
        osc.connect(gain); gain.connect(this.master);
        osc.start(t); osc.stop(t + 2.5);
      }
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.value = bass[step];
      bGain.gain.setValueAtTime(0.0001, t);
      bGain.gain.linearRampToValueAtTime(0.07, t + 0.15);
      bGain.gain.linearRampToValueAtTime(0.0001, t + 2.2);
      bOsc.connect(bGain); bGain.connect(this.master);
      bOsc.start(t); bOsc.stop(t + 2.3);
    }, 2400);
  }
}
