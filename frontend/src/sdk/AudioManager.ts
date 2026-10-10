import { useSettingsStore } from "../stores/settingsStore";
/**
 * Audio Manager - Handles all system sound effects and music.
 * Uses Web Audio API to synthesize UI sounds (no assets required).
 */
export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private init(): void {
    if (!this.ctx) {
      if (!window.AudioContext) return;
      this.ctx = new window.AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = useSettingsStore.getState().volume;
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Synthesize a retro UI sound
   * type: 'sine' | 'square' | 'sawtooth' | 'triangle'
   */
  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    fadeOut: boolean = true,
  ) {
    const preferences = useSettingsStore.getState();
    if (preferences.muted || preferences.volume === 0) return;
    try {
      this.init();
    } catch {
      return;
    }
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setValueAtTime(
      preferences.volume,
      this.ctx.currentTime,
    );

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.connect(this.masterGain);
    osc.connect(gain);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    if (fadeOut) {
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        this.ctx.currentTime + duration,
      );
    } else {
      gain.gain.setValueAtTime(0, this.ctx.currentTime + duration);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  playHover(): void {
    // High pitched "tick"
    this.playTone(800, "sine", 0.05);
  }

  playSelect(): void {
    // Confirm chord
    this.playTone(440, "triangle", 0.2); // A4
    setTimeout(() => this.playTone(554, "triangle", 0.2), 50); // C#5
  }

  playBack(): void {
    // Lower pitch cancel
    this.playTone(300, "sawtooth", 0.15);
  }

  /** Unlock from a user gesture; game effects share the audio preferences. */
  unlock(): void {
    try {
      this.init();
    } catch {
      // Unsupported audio must never interrupt a game.
    }
  }

  playGameCue(cue: "hit" | "collect" | "jump" | "miss"): void {
    const tones = {
      hit: [560, 0.045],
      collect: [880, 0.12],
      jump: [330, 0.06],
      miss: [140, 0.2],
    } as const;
    const [frequency, duration] = tones[cue];
    this.playTone(frequency, "triangle", duration);
  }

  playBoot(): void {
    // Boot sequence swell
    if (useSettingsStore.getState().muted) return;
    this.init();
    // ... (We can implement a complex boot sound later)
    this.playTone(110, "sine", 2.0);
  }

  setVolume(value: number): void {
    useSettingsStore.getState().setVolume(value);
  }
  toggleMute(): void {
    const store = useSettingsStore.getState();
    store.setMuted(!store.muted);
  }
}
