// Tiny WebAudio synth: every sound is a few oscillators shaped by a gain envelope, no audio
// files. The AudioContext is created lazily on the first user gesture (browsers block audio
// before one) and every call is a no-op until then.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 0.14;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** A single blip: an oscillator that slides from `from` Hz to `to` Hz over `seconds`. */
  function blip({ type = 'square', from = 440, to = 220, seconds = 0.08, volume = 1 }) {
    if (muted || !ensure()) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + seconds + 0.02);
  }

  /** Two blips in a row, the second `delay` seconds after the first. */
  function pair(first, second, delay) {
    blip(first);
    if (muted || context === null) return;
    const startAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = second.type ?? 'sine';
    oscillator.frequency.setValueAtTime(second.from, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, second.to), startAt + second.seconds);
    gain.gain.setValueAtTime(second.volume ?? 1, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + second.seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(startAt);
    oscillator.stop(startAt + second.seconds + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      blip({ type: 'square', from: 880, to: 520, seconds: 0.05, volume: 0.35 });
    },
    enemyShoot() {
      blip({ type: 'sawtooth', from: 220, to: 160, seconds: 0.09, volume: 0.3 });
    },
    hit() {
      blip({ type: 'sawtooth', from: 160, to: 60, seconds: 0.14, volume: 0.8 });
    },
    kill() {
      pair({ type: 'triangle', from: 520, to: 780, seconds: 0.07, volume: 0.6 }, { type: 'triangle', from: 780, to: 1180, seconds: 0.09, volume: 0.5 }, 0.06);
    },
    shard() {
      blip({ type: 'sine', from: 980, to: 1560, seconds: 0.07, volume: 0.5 });
    },
    hurt() {
      blip({ type: 'sawtooth', from: 320, to: 70, seconds: 0.22, volume: 0.9 });
    },
    dash() {
      blip({ type: 'sine', from: 300, to: 900, seconds: 0.1, volume: 0.4 });
    },
    buy() {
      pair({ type: 'sine', from: 660, to: 660, seconds: 0.07, volume: 0.6 }, { type: 'sine', from: 990, to: 990, seconds: 0.1, volume: 0.6 }, 0.07);
    },
    denied() {
      blip({ type: 'square', from: 180, to: 120, seconds: 0.12, volume: 0.5 });
    },
    waveClear() {
      pair({ type: 'triangle', from: 523, to: 523, seconds: 0.1, volume: 0.6 }, { type: 'triangle', from: 784, to: 784, seconds: 0.16, volume: 0.6 }, 0.1);
    },
    boss() {
      pair({ type: 'sawtooth', from: 110, to: 55, seconds: 0.3, volume: 0.8 }, { type: 'sawtooth', from: 165, to: 82, seconds: 0.3, volume: 0.7 }, 0.25);
    },
    win() {
      pair({ type: 'triangle', from: 523, to: 523, seconds: 0.14, volume: 0.7 }, { type: 'triangle', from: 1046, to: 1046, seconds: 0.3, volume: 0.7 }, 0.14);
    },
    lose() {
      pair({ type: 'sawtooth', from: 220, to: 110, seconds: 0.25, volume: 0.7 }, { type: 'sawtooth', from: 147, to: 55, seconds: 0.4, volume: 0.7 }, 0.22);
    },
  };
}
