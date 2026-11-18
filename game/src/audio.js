// All sound is synthesized with WebAudio — no audio files, no network.
// Created lazily on the first user gesture (browsers block audio before that).
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A lazy bassline loop while playing: soft, sunny, original. Two bars of a
  // I–vi–IV–V walk in A minor, played as sine blips so it never gets annoying.
  const BASSLINE = [55, 0, 55, 65.41, 0, 55, 0, 49, 0, 49, 55, 0, 43.65, 0, 49, 55];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = BASSLINE[musicStep % BASSLINE.length];
      musicStep += 1;
      if (note) blip(note, 0.22, 'sine', 0.09);
      if (musicStep % 4 === 1) blip(220, 0.1, 'triangle', 0.03);
    }, 240);
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    click() {
      blip(660, 0.06, 'square', 0.08);
    },
    shoot() {
      noise(0.14, 0.5, 2400);
      blip(180, 0.1, 'square', 0.22, 60);
    },
    punch() {
      noise(0.09, 0.35, 900);
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.18);
      window.setTimeout(() => blip(1320, 0.12, 'sine', 0.18), 70);
    },
    cash() {
      blip(1046, 0.08, 'triangle', 0.2);
      window.setTimeout(() => blip(1568, 0.14, 'triangle', 0.2), 80);
    },
    crash() {
      noise(0.3, 0.5, 700);
      blip(90, 0.25, 'sawtooth', 0.25, 40);
    },
    horn() {
      blip(370, 0.18, 'square', 0.1);
      blip(466, 0.18, 'square', 0.08);
    },
    jingle() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.18, 'triangle', 0.2), i * 110);
      });
    },
    busted() {
      [392, 330, 262, 196].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.3, 'sawtooth', 0.16), i * 180);
      });
    },
    setEngine(on, speedRatio) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.02;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!on && engineOsc) {
        try {
          engineOsc.stop();
        } catch {
          // Already stopped.
        }
        engineOsc = null;
        engineGain = null;
        return;
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + speedRatio * 130;
        engineGain.gain.value = 0.015 + speedRatio * 0.035;
      }
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = true;
        sirenTimer = window.setInterval(() => {
          if (sirenOsc) sirenOsc.frequency.value = high ? 950 : 700;
          high = !high;
        }, 420);
      } else if (!on && sirenOsc) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        try {
          sirenOsc.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    startMusic,
  };
}
