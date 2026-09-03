import { useSettingsStore } from "../../shared/state/settingsStore";
/** Quiet synthesized engine bed, separate from the console's one-shot cues. */
export class FlightAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private enabled = true;
  private started = false;
  private failed = false;
  private lastFrequency = NaN;
  private lastGain = NaN;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private changingContext = false;

  private get audible() {
    const preferences = useSettingsStore.getState();
    return this.enabled && !preferences.muted && preferences.volume > 0;
  }

  private requestPlayback() {
    if (!this.context) return;
    if (this.audible) {
      if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
      this.syncContext();
    } else if (
      !this.changingContext &&
      this.context.state === "running" &&
      this.suspendTimer === null
    ) {
      // Let the existing fade finish before suspending silent audio processing.
      this.suspendTimer = setTimeout(() => {
        this.suspendTimer = null;
        this.syncContext();
      }, 500);
    }
  }

  private syncContext() {
    const context = this.context,
      audible = this.audible;
    if (
      !context ||
      this.changingContext ||
      (!audible && this.suspendTimer !== null)
    )
      return;
    if (
      (audible && context.state !== "suspended") ||
      (!audible && context.state !== "running")
    )
      return;
    this.changingContext = true;
    void (audible ? context.resume() : context.suspend())
      .catch(() => {})
      .finally(() => {
        if (this.context !== context) return;
        this.changingContext = false;
        // A rapid pause/resume may change the desired state while the browser waits.
        if (this.audible !== audible) this.syncContext();
      });
  }

  private setGain(value: number, smoothing: number) {
    if (!this.gain || !this.context || value === this.lastGain) return;
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, smoothing);
    this.lastGain = value;
  }
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
    const frequency = 48 + Math.min(1000, speed) * 0.08;
    if (this.audible && frequency !== this.lastFrequency) {
      this.engine.frequency.setTargetAtTime(
        frequency,
        this.context.currentTime,
        0.15,
      );
      this.lastFrequency = frequency;
    }
    this.setGain(
      this.audible ? preferences.volume * (boosting ? 0.065 : 0.035) : 0,
      0.1,
    );
    this.requestPlayback();
  }
  pause() {
    this.enabled = false;
    this.setGain(0, 0.04);
    this.requestPlayback();
  }
  resume() {
    this.enabled = true;
    this.requestPlayback();
  }
  destroy() {
    if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    if (this.started) this.engine?.stop();
    this.started = false;
    this.engine?.disconnect();
    this.gain?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.engine = null;
    this.gain = null;
    this.changingContext = false;
    this.lastFrequency = this.lastGain = NaN;
  }
}
