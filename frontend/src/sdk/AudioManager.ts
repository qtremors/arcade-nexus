import type { AudioPort } from "./RuntimePorts";
/**
 * Audio Manager - Handles all system sound effects and music.
 * Uses Web Audio API to synthesize UI sounds (no assets required).
 */
export class AudioManager {
  private static instance: AudioManager;
  private static ports: AudioPort = {
    readPreferences: () => ({ muted: false, volume: 0.5 }),
    subscribe: () => () => {},
    setVolume: () => {},
    setMuted: () => {},
  };
  private unsubscribe?: () => void;
  static configure(ports: AudioPort) {
    AudioManager.ports = ports;
    AudioManager.instance?.bindPreferences();
  }
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private activeUntil = 0;
  private changingContext = false;

  private constructor() {
    this.bindPreferences();
  }
  private bindPreferences() {
    this.unsubscribe?.();
    this.unsubscribe = AudioManager.ports.subscribe(() => {
      if (!this.ctx || !this.masterGain) return;
      const { muted, volume } = AudioManager.ports.readPreferences();
      try {
        this.masterGain.gain.setValueAtTime(
          muted ? 0 : volume,
          this.ctx.currentTime,
        );
        if (muted || volume === 0) this.activeUntil = 0;
        this.syncContext();
      } catch {
        /* Audio availability must not affect settings or gameplay. */
      }
    });
  }

  private syncContext() {
    const context = this.ctx;
    if (!context || this.changingContext) return;
    const { muted, volume } = AudioManager.ports.readPreferences();
    const active = !muted && volume > 0 && performance.now() < this.activeUntil;
    if (
      (active && context.state !== "suspended") ||
      (!active && context.state !== "running")
    )
      return;
    this.changingContext = true;
    void (active ? context.resume() : context.suspend())
      .catch(() => {})
      .finally(() => {
        this.changingContext = false;
        if (
          this.ctx === context &&
          active !==
            (!AudioManager.ports.readPreferences().muted &&
              AudioManager.ports.readPreferences().volume > 0 &&
              performance.now() < this.activeUntil)
        )
          this.syncContext();
      });
  }

  private keepActive(duration: number) {
    this.activeUntil = Math.max(
      this.activeUntil,
      performance.now() + duration * 1000 + 100,
    );
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(
      () => {
        this.idleTimer = null;
        this.syncContext();
      },
      Math.max(0, this.activeUntil - performance.now()),
    );
    this.syncContext();
  }

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
      this.masterGain.gain.value = AudioManager.ports.readPreferences().volume;
    }
  }

  private releaseFailedContext() {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.activeUntil = 0;
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
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
    const preferences = AudioManager.ports.readPreferences();
    if (preferences.muted || preferences.volume === 0) return;
    try {
      this.init();
      if (!this.ctx || !this.masterGain) return;
      this.keepActive(duration);
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
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      if (fadeOut)
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          this.ctx.currentTime + duration,
        );
      else gain.gain.setValueAtTime(0, this.ctx.currentTime + duration);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Browsers can deny audio or lose their audio device during a session.
      this.releaseFailedContext();
    }
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
    const { muted, volume } = AudioManager.ports.readPreferences();
    if (muted || volume === 0) return;
    try {
      this.init();
      this.keepActive(0.4);
    } catch {
      // Unsupported audio must never interrupt a game.
      this.releaseFailedContext();
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
    // Boot sequence swell, with the same graceful fallback as other cues.
    this.playTone(110, "sine", 2.0);
  }

  setVolume(value: number): void {
    AudioManager.ports.setVolume(value);
  }
  toggleMute(): void {
    const store = AudioManager.ports.readPreferences();
    AudioManager.ports.setMuted(!store.muted);
  }
}
