/**
 * VoiceControlPanel — compact control bar for Sasha's voice.
 *
 * Always shown: a mute toggle (🔊 Voice on / 🔇 Voice off).
 * Shown only while speaking / fetching / paused: a "now speaking" line with
 * transport (play/pause + stop) and two small sliders (speed, volume).
 *
 * Lives in the ChatPanel header so it's always reachable while chatting.
 */
import { useVoice } from '../context/VoiceContext';
import {
  SpeakerIcon,
  SpeakerMutedIcon,
  PlayIcon,
  PauseIcon,
  StopSquareIcon,
} from './IconComponents';

export default function VoiceControlPanel() {
  const {
    muted,
    setMuted,
    isSpeaking,
    isFetching,
    isPaused,
    speakingText,
    pause,
    resume,
    stop,
    rate,
    setRate,
    volume,
    setVolume,
  } = useVoice();

  const active = isSpeaking || isFetching || isPaused;

  return (
    <div className="lws-voice-bar">
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        className="lws-voice-mute"
        aria-pressed={!muted}
        title={muted ? 'Voice is off' : 'Voice is on'}
      >
        {muted ? (
          <SpeakerMutedIcon width={13} height={13} />
        ) : (
          <SpeakerIcon width={13} height={13} />
        )}
        <span className="hidden sm:inline">{muted ? 'Voice Off' : 'Voice On'}</span>
      </button>

      {active && !muted && (
        <div className="lws-voice-transport" role="group" aria-label="Voice playback">
          {/* Transport: play/pause + stop. */}
          {isFetching ? (
            <span
              className="lws-voice-spinner"
              aria-label="Generating voice"
              title="Generating voice…"
            />
          ) : isSpeaking ? (
            <button
              type="button"
              onClick={pause}
              className="lws-voice-btn"
              aria-label="Pause voice"
              title="Pause"
            >
              <PauseIcon width={14} height={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={resume}
              className="lws-voice-btn"
              aria-label="Resume voice"
              title="Resume"
            >
              <PlayIcon width={14} height={14} />
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            className="lws-voice-btn"
            aria-label="Stop voice"
            title="Stop"
            disabled={isFetching}
          >
            <StopSquareIcon width={14} height={14} />
          </button>

          {/* Sliders (hide labels on very small screens to save room). */}
          <label className="lws-voice-slider" title={`Speed: ${rate.toFixed(2)}×`}>
            <span className="lws-voice-slider-label" aria-hidden>
              Speed
            </span>
            <input
              type="range"
              min={0.75}
              max={1.5}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              aria-label="Voice speed"
            />
          </label>
          <label
            className="lws-voice-slider"
            title={`Volume: ${Math.round(volume * 100)}%`}
          >
            <span className="lws-voice-slider-label" aria-hidden>
              Vol
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Voice volume"
            />
          </label>

          {/* Truncated "now speaking" text — gives feedback that the right
              thing is being read out. */}
          {speakingText && (
            <span className="lws-voice-now lws-small" title={speakingText}>
              {isFetching ? 'Generating…' : '“' + speakingText.slice(0, 32) + '”'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
