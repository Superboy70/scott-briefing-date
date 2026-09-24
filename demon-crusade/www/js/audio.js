'use strict';
// 간단한 WebAudio 신스 효과음 + 배경음 (외부 파일 없음)
const Audio8 = (() => {
  let ac = null, master = null, musicGain = null, sfxGain = null;
  let musicOn = true, sfxOn = true;
  let seqTimer = null, seqStep = 0, nextTime = 0, song = null;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.gain.value = sfxOn ? 1 : 0; sfxGain.connect(master);
    musicGain = ac.createGain(); musicGain.gain.value = musicOn ? 0.35 : 0; musicGain.connect(master);
  }

  function tone(freq, dur, type = 'square', vol = 0.12, slide = 0, when = 0, dest = null) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.15, when = 0, hp = 800) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  const SFX = {
    throw: () => { tone(620, 0.06, 'square', 0.06, -300); },
    hit: () => { noise(0.06, 0.12, 0, 1500); tone(180, 0.05, 'square', 0.05, -80); },
    kill: () => { noise(0.18, 0.14, 0, 400); tone(220, 0.18, 'sawtooth', 0.06, -160); },
    hurt: () => { tone(300, 0.2, 'sawtooth', 0.12, -220); noise(0.1, 0.1); },
    armor: () => { for (let i = 0; i < 5; i++) tone(900 - i * 120, 0.08, 'square', 0.08, -200, i * 0.04); noise(0.3, 0.15, 0, 2000); },
    jump: () => { tone(260, 0.1, 'square', 0.05, 240); },
    gold: () => { tone(1320, 0.05, 'square', 0.05); tone(1760, 0.08, 'square', 0.05, 0, 0.05); },
    pickup: () => { tone(660, 0.06, 'triangle', 0.08); tone(990, 0.08, 'triangle', 0.08, 0, 0.06); },
    potion: () => { tone(400, 0.25, 'sine', 0.12, 400); },
    drop: () => { tone(500, 0.07, 'triangle', 0.06, -100); },
    rare: () => { [880, 1108, 1320].forEach((f, i) => tone(f, 0.15, 'triangle', 0.09, 0, i * 0.07)); },
    unique: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.08)); },
    level: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'square', 0.07, 0, i * 0.09)); },
    spell: () => { tone(900, 0.2, 'sine', 0.08, -600); noise(0.15, 0.06, 0, 3000); },
    smite: () => { tone(140, 0.2, 'square', 0.12, -60); noise(0.12, 0.14, 0, 600); },
    tele: () => { tone(300, 0.15, 'sine', 0.1, 1200); },
    shrine: () => { [660, 880, 1320].forEach((f, i) => tone(f, 0.3, 'sine', 0.08, 0, i * 0.1)); },
    boss: () => { tone(80, 0.8, 'sawtooth', 0.15, -30); tone(83, 0.8, 'sawtooth', 0.12, -30); },
    curse: () => { [600, 500, 400, 300].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, 0, i * 0.1)); },
    fire: () => { noise(0.25, 0.08, 0, 300); },
    zap: () => { noise(0.08, 0.12, 0, 4000); tone(1500, 0.06, 'square', 0.05, -900); },
    click: () => { tone(700, 0.04, 'square', 0.04); },
    die: () => { [330, 262, 196, 131].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.1, 0, i * 0.25)); },
  };

  function play(name) { if (ac && sfxOn && SFX[name]) SFX[name](); }

  // ---- 배경음: 막(act)별 단조 루프 ----
  const SONGS = {
    town: { bpm: 84, bass: [45, 0, 52, 0, 45, 0, 50, 0, 43, 0, 50, 0, 45, 0, 52, 0], lead: [69, 0, 0, 72, 0, 0, 71, 0, 67, 0, 0, 69, 0, 0, 0, 0], wave: 'triangle' },
    act0: { bpm: 132, bass: [40, 40, 52, 40, 43, 43, 55, 43, 38, 38, 50, 38, 40, 40, 52, 47], lead: [64, 0, 67, 0, 71, 0, 69, 67, 64, 0, 62, 0, 64, 0, 0, 0], wave: 'square' },
    act1: { bpm: 112, bass: [38, 0, 45, 38, 41, 0, 48, 41, 36, 0, 43, 36, 38, 0, 45, 40], lead: [62, 0, 65, 0, 69, 0, 68, 0, 65, 0, 64, 0, 62, 0, 0, 0], wave: 'triangle' },
    act2: { bpm: 144, bass: [36, 36, 48, 36, 39, 39, 51, 39, 41, 41, 53, 41, 43, 43, 55, 42], lead: [72, 0, 75, 72, 0, 79, 0, 78, 75, 0, 72, 0, 70, 0, 71, 0], wave: 'sawtooth' },
    act3: { bpm: 120, bass: [33, 33, 45, 33, 34, 34, 46, 34, 33, 33, 45, 33, 32, 32, 44, 32], lead: [57, 0, 60, 0, 63, 0, 62, 0, 60, 0, 58, 0, 57, 0, 56, 0], wave: 'sawtooth' },
    boss: { bpm: 156, bass: [33, 45, 33, 45, 34, 46, 34, 46, 36, 48, 36, 48, 35, 47, 35, 47], lead: [69, 0, 68, 0, 69, 0, 72, 0, 71, 0, 68, 0, 65, 0, 64, 0], wave: 'square' },
  };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function schedule() {
    if (!ac || !song) return;
    const stepDur = 60 / song.bpm / 2;
    while (nextTime < ac.currentTime + 0.25) {
      const i = seqStep % 16;
      const when = nextTime - ac.currentTime;
      const b = song.bass[i], l = song.lead[i];
      if (b) tone(midi(b), stepDur * 0.9, 'triangle', 0.18, 0, Math.max(0, when), musicGain);
      if (l) tone(midi(l), stepDur * 1.6, song.wave, 0.05, 0, Math.max(0, when), musicGain);
      nextTime += stepDur; seqStep++;
    }
  }

  function music(name) {
    if (!ac) return;
    const s = SONGS[name] || null;
    if (s === song) return;
    song = s; seqStep = 0; nextTime = ac.currentTime + 0.05;
    if (!seqTimer) seqTimer = setInterval(schedule, 100);
  }

  function setMusic(on) { musicOn = on; if (musicGain) musicGain.gain.value = on ? 0.35 : 0; }
  function setSfx(on) { sfxOn = on; if (sfxGain) sfxGain.gain.value = on ? 1 : 0; }
  function suspend() { if (ac && ac.state === 'running') ac.suspend(); }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  return { init, play, music, setMusic, setSfx, suspend, resume, get musicOn() { return musicOn; }, get sfxOn() { return sfxOn; } };
})();
