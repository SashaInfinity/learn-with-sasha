/**
 * VoiceContext — React bridge to the singleton voice manager (src/lib/voice.ts).
 *
 * Exposes:
 *   - isSpeaking / amplitude: live state for Sasha's talk animation.
 *   - muted / setMuted: the global sound toggle (sound pill in the header).
 *   - speak(text): play text through Piper.
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

export type SashaMood = 'idle' | 'wave' | 'thinking' | 'talking' | 'celebrate' | 'shake';

interface VoiceContextValue {
  isSpeaking: boolean;
  amplitude: number;
  muted: boolean;
  setMuted: (m: boolean) => void;
  speak: (text: string) => void;
  mood: SashaMood;
  setMood: (m: SashaMood) => void;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  // Snapshot state mirrored from the singleton; updated via subscription.
  const [isSpeaking, setIsSpeaking] = useState(voice.isSpeaking());
  const [muted, setMutedState] = useState(voice.isMuted());
  // amplitude changes ~60x/sec; we don't want React re-renders for that.
  // Expose a ref + a getter so SashaStage can read it in its own rAF loop
  // without triggering renders. We still bump a low-frequency state so any
  // UI that genuinely needs amplitude (e.g. a meter) can subscribe.
  const amplitudeRef = useRef(voice.getAmplitude());
  const [mood, setMood] = useState<SashaMood>('idle');

  useEffect(() => {
    const unsub = voice.subscribe(() => {
      setIsSpeaking(voice.isSpeaking());
      setMutedState(voice.isMuted());
      amplitudeRef.current = voice.getAmplitude();
      // Talking mood follows the speaking state automatically.
      setMood((prev) =>
        voice.isSpeaking() ? 'talking' : prev === 'talking' ? 'idle' : prev,
      );
    });
    return unsub;
  }, []);

  const setMuted = useCallback((m: boolean) => voice.setMuted(m), []);
  const speak = useCallback((text: string) => {
    void voice.speak(text);
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        isSpeaking,
        amplitude: amplitudeRef.current,
        muted,
        setMuted,
        speak,
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
