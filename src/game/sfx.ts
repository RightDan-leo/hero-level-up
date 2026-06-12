/** 程序化 WebAudio 音效，无需任何音频资源。 */
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.18, slideTo?: number): void {
  if (muted) return;
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export const Sfx = {
  setMuted(m: boolean) { muted = m; },
  isMuted() { return muted; },
  clash() { tone(220, 0.12, 'square', 0.16, 90); tone(330, 0.1, 'triangle', 0.1); },
  absorb() { tone(440, 0.16, 'sine', 0.16, 880); },
  rally() { tone(523, 0.1, 'triangle', 0.14); setTimeout(() => tone(784, 0.14, 'triangle', 0.14), 70); },
  evolve() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sawtooth', 0.12), i * 70)); },
  reject() { tone(160, 0.18, 'sawtooth', 0.18, 80); },
  dragon() { tone(110, 0.7, 'sawtooth', 0.22, 55); setTimeout(() => tone(220, 0.5, 'square', 0.14), 200); },
  victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.14), i * 110)); },
};
