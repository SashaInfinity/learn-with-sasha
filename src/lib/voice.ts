/**
 * Voice playback manager for Sasha's spoken replies.
 *
 * Single playback at a time (new speak() interrupts the previous). Pipes audio
 * through a Web Audio AnalyserNode so the 3D stage can drive Sasha's talk
 * animation from the live amplitude.
 *
 * This is a singleton (module-level) so the audio graph persists across route
 * changes; React reads its state via VoiceContext.
 */

type Listener = () => void;

class VoiceManager {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private buf: Float32Array | null = null;

  private muted = false;
  private speaking = false;
  private amplitude = 0; // 0..1, smoothed RMS of the current frame

  private listeners = new Set<Listener>();

  isMuted() {
    return this.muted;
  }
  isSpeaking() {
    return this.speaking;
  }
  getAmplitude() {
    return this.amplitude;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const l of this.listeners) l();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stop();
    this.emit();
  }

  /** Speak the given text. Interrupts any current playback. No-op if muted. */
  async speak(text: string): Promise<void> {
    if (this.muted || !text.trim()) return;
    this.stop();

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text.slice(0, 500) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audio.crossOrigin = 'anonymous';
      this.audio = audio;

      // Lazy-init the Web Audio graph once (browsers require a user gesture
      // for AudioContext; speak() is called from a click or a reply arrival
      // after user interaction, so this is allowed).
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctor();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        this.ctx = ctx;
        this.analyser = analyser;
        this.buf = new Float32Array(analyser.fftSize);
      }
      const ctx = this.ctx;
      const analyser = this.analyser;
      if (!ctx || !analyser) return;
      // A MediaElementSource can only be created once per element; we recreate
      // the element each speak() so this is safe.
      this.source = ctx.createMediaElementSource(audio);
      this.source.connect(analyser);
      analyser.connect(ctx.destination);

      audio.onplay = () => {
        if (this.ctx?.state === 'suspended') void this.ctx.resume();
        this.speaking = true;
        this.emit();
        this.tick();
      };
      audio.onended = () => {
        this.finish();
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        this.finish();
        URL.revokeObjectURL(url);
      };

      await audio.play().catch(() => {
        // Autoplay can be blocked before any user gesture; just give up quietly.
        this.finish();
        URL.revokeObjectURL(url);
      });
    } catch {
      this.finish();
    }
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    if (this.speaking) {
      this.speaking = false;
      this.amplitude = 0;
      this.emit();
    }
  }

  private finish() {
    this.speaking = false;
    this.amplitude = 0;
    this.audio = null;
    this.emit();
  }

  /** rAF loop: sample amplitude while speaking. */
  private tick = () => {
    if (!this.speaking || !this.analyser || !this.buf) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);
    // Smooth so the head bob doesn't jitter on every sample.
    this.amplitude = this.amplitude * 0.6 + Math.min(rms * 3, 1) * 0.4;
    this.emit();
    if (this.speaking) requestAnimationFrame(this.tick);
  };
}

/** Singleton — one audio graph for the whole app. */
export const voice = new VoiceManager();
