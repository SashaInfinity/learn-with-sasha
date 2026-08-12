/**
 * VoiceContext — React bridge to the singleton voice manager (src/lib/voice.ts).
 *
 * Exposes:
 *   - isSpeaking / isFetching / speakingText: live playback state for the UI.
 *   - amplitude: live value for Sasha's talk animation.
 *   - muted / setMuted: global sound toggle.
 *   - rate / setRate, volume / setVolume: live playback params (0.75–1.5 / 0–1).
 *   - speak / pause / resume / stop: transport controls.
 *   - sashaMood / setMood: the current interaction beat (idle/wave/thinking/
 *     talking/celebrate/shake). SashaStage reads it to overlay a transform.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { voice } from '../lib/voice';

export type SashaMood =
  | 'idle'
  | 'wave'
  | 'thinking'
  | 'talking'
  | 'celebrate'
  | 'shake'
  | 'attentive';

interface VoiceContextValue {
  isSpeaking: boolean;
  isFetching: boolean;
  isPaused: boolean;
  speakingText: string;
  amplitude: number;
  muted: boolean;
  setMuted: (m: boolean) => void;
  rate: number;
  setRate: (r: number) => void;
  volume: number;
  setVolume: (v: number) => void;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  mood: SashaMood;
  setMood: (m: SashaMood) => void;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  // Snapshot state mirrored from the singleton; updated via subscription.
  const [isSpeaking, setIsSpeaking] = useState(voice.isSpeaking());
  const [isFetching, setIsFetching] = useState(voice.isFetching());
  const [isPaused, setIsPaused] = useState(voice.isPaused());
  const [speakingText, setSpeakingText] = useState(voice.getSpeakingText());
  const [muted, setMutedState] = useState(voice.isMuted());
  const [rate, setRateState] = useState(voice.getRate());
  const [volume, setVolumeState] = useState(voice.getVolume());
  // amplitude changes ~60x/sec; we don't want React re-renders for that.
  // Expose a ref so SashaStage can read it in its own rAF loop without
  // triggering renders.
  const amplitudeRef = useRef(voice.getAmplitude());
  const [mood, setMood] = useState<SashaMood>('idle');

  useEffect(() => {
    const unsub = voice.subscribe(() => {
      setIsSpeaking(voice.isSpeaking());
      setIsFetching(voice.isFetching());
      setIsPaused(voice.isPaused());
      setSpeakingText(voice.getSpeakingText());
      setMutedState(voice.isMuted());
      setRateState(voice.getRate());
      setVolumeState(voice.getVolume());
      amplitudeRef.current = voice.getAmplitude();
      // Talking mood follows the speaking state automatically.
      setMood((prev) =>
        voice.isSpeaking() ? 'talking' : prev === 'talking' ? 'idle' : prev,
      );
    });
    return unsub;
  }, []);

  const setMuted = useCallback((m: boolean) => voice.setMuted(m), []);
  const setRate = useCallback((r: number) => voice.setRate(r), []);
  const setVolume = useCallback((v: number) => voice.setVolume(v), []);
  const speak = useCallback((text: string) => {
    void voice.speak(text);
  }, []);
  const pause = useCallback(() => voice.pause(), []);
  const resume = useCallback(() => voice.resume(), []);
  const stop = useCallback(() => voice.stop(), []);

  return (
    <VoiceContext.Provider
      value={{
        isSpeaking,
        isFetching,
        isPaused,
        speakingText,
        amplitude: amplitudeRef.current,
        muted,
        setMuted,
        rate,
        setRate,
        volume,
        setVolume,
        speak,
        pause,
        resume,
        stop,
        mood,
        setMood,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a <VoiceProvider>');
  return ctx;
}

/** Direct access to the singleton's live amplitude for the render loop. */
export function getVoiceAmplitude(): number {
  return voice.getAmplitude();
}
