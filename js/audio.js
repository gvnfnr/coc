/* audio.js — tiny synthesized SFX engine (WebAudio). No external assets. */
(function (COC) {
  'use strict';
  const A = { muted: false, ctx: null };

  function ensure() {
    if (A.ctx) return A.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      A.ctx = new AC();
    } catch (e) { return null; }
    return A.ctx;
  }
  A.resume = function () { const c = ensure(); if (c && c.state === 'suspended') c.resume(); };
  A.toggleMute = function () { A.muted = !A.muted; return A.muted; };

  function tone(freq, t0, dur, type, gain, slideTo) {
    const ctx = A.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, gain) {
    const ctx = A.ctx;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain || 0.18;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t0);
  }

  A.play = function (name) {
    if (A.muted) return;
    const ctx = ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'shoot': tone(620, t, 0.08, 'square', 0.05, 380); break;
      case 'thunk': tone(180, t, 0.12, 'sine', 0.12, 90); break;
      case 'boom': noise(t, 0.3, 0.22); tone(90, t, 0.25, 'sine', 0.12, 40); break;
      case 'deploy': tone(300, t, 0.12, 'triangle', 0.1, 600); break;
      case 'spring': tone(300, t, 0.18, 'sine', 0.12, 900); break;
      case 'zap': tone(1200, t, 0.18, 'sawtooth', 0.1, 200); noise(t, 0.18, 0.1); break;
      case 'spell': tone(500, t, 0.2, 'triangle', 0.08, 800); break;
      case 'collect': tone(880, t, 0.07, 'square', 0.07, 1320); tone(1320, t + 0.06, 0.07, 'square', 0.06); break;
      case 'place': tone(160, t, 0.12, 'sine', 0.14, 80); break;
      case 'build': tone(440, t, 0.1, 'triangle', 0.08, 660); break;
      case 'error': tone(200, t, 0.12, 'sawtooth', 0.08, 140); break;
      case 'win': [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.1, 0.18, 'triangle', 0.1); }); break;
      case 'lose': [392, 330, 262].forEach(function (f, i) { tone(f, t + i * 0.12, 0.22, 'sine', 0.1); }); break;
      case 'click': tone(700, t, 0.04, 'square', 0.04); break;
    }
  };

  COC.Audio = A;
})(window.COC);
