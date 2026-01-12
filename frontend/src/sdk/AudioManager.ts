/**
 * Audio Manager - Handles all system sound effects and music.
 * Uses Web Audio API to synthesize UI sounds (no assets required).
 */
export class AudioManager {
    private static instance: AudioManager;
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private volume: number = 0.5;
    private isMuted: boolean = false;

    private constructor() { }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private init(): void {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = this.volume;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Synthesize a retro UI sound
     * type: 'sine' | 'square' | 'sawtooth' | 'triangle'
     */
    private playTone(freq: number, type: OscillatorType, duration: number, fadeOut: boolean = true) {
        this.init();
        if (!this.ctx || !this.masterGain || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.connect(this.masterGain);
        osc.connect(gain);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        if (fadeOut) {
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        } else {
            gain.gain.setValueAtTime(0, this.ctx.currentTime + duration);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playHover(): void {
        // High pitched "tick"
        this.playTone(800, 'sine', 0.05);
    }

    playSelect(): void {
        // Confirm chord
        this.playTone(440, 'triangle', 0.2); // A4
        setTimeout(() => this.playTone(554, 'triangle', 0.2), 50); // C#5
    }

    playBack(): void {
        // Lower pitch cancel
        this.playTone(300, 'sawtooth', 0.15);
    }

    playBoot(): void {
        // Boot sequence swell
        if (!this.ctx || this.isMuted) return;
        this.init();
        // ... (We can implement a complex boot sound later)
        this.playTone(110, 'sine', 2.0);
    }

    setVolume(value: number): void {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx?.currentTime || 0);
        }
    }

    toggleMute(): void {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx?.currentTime || 0);
        }
    }
}
