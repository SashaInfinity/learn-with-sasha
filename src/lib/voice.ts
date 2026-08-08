/**
 * Voice playback manager for Sasha's spoken replies.
 *
 * NOTE: Sasha's voice is currently disabled across the entire site. The
 * singleton starts muted, setMuted() cannot unmute it, and speak() is a
 * permanent no-op — so no /api/tts request is ever made and no audio ever
 * plays. The rest of the API (mute/transport/rate/volume state, amplitude)
 * is preserved so the existing UI and animation plumbing keeps working
 * unchanged; amplitude simply stays 0. React reads state via VoiceContext.
 */

type Listener = () => void;

class VoiceManager {
  private audio: HTMLAudioElement | null = null;

  // Voice is disabled across the whole site. The singleton starts muted and
  // stays muted — setMuted() ignores attempts to unmute, and speak() is a
  // no-op, so no /api/tts request is ever made and no audio ever plays.
  private muted = true;
  private speaking = false;
  private fetching = false; // true while a TTS clip is being requested
  private amplitude = 0; // 0..1, smoothed RMS of the current frame
  private speakingText = ''; // the text currently being spoken (for the UI)

  // Live-adjustable playback params.
  private rate = 1;
  private volume = 1;

  private listeners = new Set<Listener>();

  isMuted() {
    return this.muted;
  }
  isSpeaking() {
    return this.speaking;
  }
  isFetching() {
    return this.fetching;
  }
  getAmplitude() {
    return this.amplitude;
  }
  getSpeakingText() {
    return this.speakingText;
  }
  getRate() {
    return this.rate;
  }
  getVolume() {
    return this.volume;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const l of this.listeners) l();
  }

  setMuted(muted: boolean) {
    // Voice is disabled site-wide: ignore any attempt to unmute. The UI toggle
    // still flips, but `muted` is clamped to true so audio can never play.
    this.muted = true;
    if (muted) this.stop();
    this.emit();
  }

  setRate(rate: number) {
    this.rate = Math.min(1.5, Math.max(0.75, rate));
    if (this.audio) this.audio.playbackRate = this.rate;
    this.emit();
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.audio) this.audio.volume = this.volume;
    this.emit();
  }

  /**
   * Speak the given text. Voice is disabled across the site, so this is a
   * permanent no-op: it never calls /api/tts and never plays audio. The method
   * is retained so the existing call sites and UI plumbing compile and run
   * without change.
   */
  async speak(_text: string): Promise<void> {
    return;
  }

  /** Pause the current clip. No-op if nothing is playing. */
  pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  /** Resume a paused clip. */
  resume() {
    if (this.audio && this.audio.paused && !this.audio.ended) {
      void this.audio.play().catch(() => {});
    }
  }

  /** Is the current clip paused (vs playing or stopped)? */
  isPaused() {
    return !!this.audio && this.audio.paused && !this.audio.ended;
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    if (this.speaking || this.fetching) {
      this.speaking = false;
      this.fetching = false;
      this.amplitude = 0;
      this.speakingText = '';
      this.emit();
    }
  }
}

/** Singleton — one audio graph for the whole app. */
export const voice = new VoiceManager();
