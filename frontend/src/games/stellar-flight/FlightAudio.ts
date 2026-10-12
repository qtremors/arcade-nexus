import { useSettingsStore } from "../../stores/settingsStore";
/** Quiet synthesized engine bed, separate from the console's one-shot cues. */
export class FlightAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private enabled = true;
  private started = false;
  private failed = false;
  update(speed: number, boosting: boolean) {
    if (this.failed) return;
    const preferences = useSettingsStore.getState();
    if (
      !this.context &&
      this.enabled &&
      !preferences.muted &&
      preferences.volume > 0
    ) {
      try {
        if (!window.AudioContext) return;
        this.context = new AudioContext();
        this.engine = this.context.createOscillator();
        this.engine.type = "triangle";
        const filter = this.context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 300;
        this.gain = this.context.createGain();
        this.gain.gain.value = 0;
        this.engine.connect(filter);
        filter.connect(this.gain);
        this.gain.connect(this.context.destination);
        this.engine.start();
        this.started = true;
      } catch {
        this.destroy();
        this.failed = true;
        return;
      }
    }
    if (!this.context || !this.gain || !this.engine) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(
      48 + Math.min(1000, speed) * 0.08,
      now,
      0.15,
    );
    this.gain.gain.setTargetAtTime(
      !this.enabled || preferences.muted
        ? 0
        : preferences.volume * (boosting ? 0.065 : 0.035),
      now,
      0.1,
    );
    if (
      this.enabled &&
      !preferences.muted &&
      this.context.state === "suspended"
    )
      void this.context.resume().catch(() => {});
  }
  pause() {
    this.enabled = false;
    if (this.gain && this.context)
      this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.04);
  }
  resume() {
    this.enabled = true;
  }
  destroy() {
    if (this.started) this.engine?.stop();
    this.started = false;
    this.engine?.disconnect();
    this.gain?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.engine = null;
    this.gain = null;
  }
}
