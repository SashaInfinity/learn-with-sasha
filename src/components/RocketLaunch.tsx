/**
 * The rocket entrance overlay. Pure presentation — it knows nothing about
 * three.js and simply renders whatever EntranceState it is handed.
 */
import type { EntranceState } from '../stage/types';

interface RocketLaunchProps {
  state: EntranceState;
  /** GLB download progress 0..1, shown as a ring while the timeline is gated. */
  loadProgress: number;
}

export default function RocketLaunch({ state, loadProgress }: RocketLaunchProps) {
  if (state.complete) return null;

  // Travel from just below the viewport to the burst point above centre.
  const travel = state.rocketProgress;
  const bottom = `${-12 + travel * 62}vh`;
  const rocketOpacity = state.phase === 'launch' ? 1 : Math.max(0, 1 - state.flare * 1.2);
  const rocketScale = state.phase === 'launch' ? 1 : 1 + (1 - state.flare) * 0.6;

  // While gated on the download, the ring reports real progress.
  const gated = state.phase === 'burst';
  const ringLength = 2 * Math.PI * 22;

  return (
    <div className="lws-rocket-layer" aria-hidden>
      <div
        className="lws-rocket-flare"
        style={{
          opacity: state.flare * 0.9,
          transform: `scale(${0.4 + state.flare * 2.4})`,
        }}
      />
      <div
        className="lws-rocket"
        style={{ bottom, opacity: rocketOpacity, transform: `scale(${rocketScale})` }}
      >
        <svg width="46" height="72" viewBox="0 0 46 72" fill="none">
          <path
            d="M23 2c8 8 12 18 12 30v16H11V32C11 20 15 10 23 2z"
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth="2"
          />
          <circle cx="23" cy="26" r="6" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
          <path d="M11 40 2 54h9V40z" fill="#f97316" />
          <path d="M35 40l9 14h-9V40z" fill="#f97316" />
        </svg>
        <span className="lws-rocket-flame" />
        {gated && (
          <svg className="lws-rocket-ring" width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" stroke="#fde68a" strokeWidth="3" fill="none" />
            <circle
              cx="26"
              cy="26"
              r="22"
              stroke="#f59e0b"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={ringLength}
              strokeDashoffset={ringLength * (1 - loadProgress)}
              transform="rotate(-90 26 26)"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
