// 轻量程序化音效（WebAudio 合成，无需音频资源）。
// 战斗即时反馈，可随时替换为正式音频。
// 所有调用都做异常保护，AudioContext 在首次用户手势后自动恢复。

const STORAGE_KEY = 'hlu_muted';

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persist(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
let muted = loadMuted();

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOptions {
  from: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function tone({ from, to = from, duration, type = 'sine', gain = 0.12 }: ToneOptions): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const vol = ac.createGain();
    const now = ac.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.linearRampToValueAtTime(to, now + duration);
    vol.gain.setValueAtTime(gain, now);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(vol);
    vol.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    /* ignore */
  }
}

export const Sfx = {
  setMuted(value: boolean): void {
    muted = value;
    persist(value);
  },
  isMuted(): boolean {
    return muted;
  },
  /** 切换静音并返回切换后的状态。 */
  toggleMuted(): boolean {
    muted = !muted;
    persist(muted);
    return muted;
  },
  /** 吸收战力：上扬清脆音，音高随增益略升。 */
  absorb(scale = 1): void {
    tone({ from: 520 + scale * 120, to: 880 + scale * 160, duration: 0.14, type: 'triangle', gain: 0.14 });
  },
  /** 战力不足被挡：低沉闷击。 */
  block(): void {
    tone({ from: 180, to: 90, duration: 0.22, type: 'sawtooth', gain: 0.16 });
  },
  /** 通关：胜利上扬音。 */
  win(): void {
    tone({ from: 440, to: 880, duration: 0.45, type: 'square', gain: 0.12 });
  },
  /** 开宝箱：清脆叮当 + 上扬闪光音。 */
  chest(): void {
    tone({ from: 660, to: 1320, duration: 0.18, type: 'triangle', gain: 0.14 });
    tone({ from: 990, to: 1760, duration: 0.3, type: 'sine', gain: 0.1 });
  },
  /** 形态进化：恢弘上扬和弦。 */
  evolve(): void {
    tone({ from: 330, to: 660, duration: 0.5, type: 'square', gain: 0.13 });
    tone({ from: 495, to: 990, duration: 0.55, type: 'triangle', gain: 0.1 });
  },
};
