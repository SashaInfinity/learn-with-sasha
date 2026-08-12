/**
 * Sidebar — the sessions rail.
 *
 * Lists previous conversations, lets the student start a new one, switch, and
 * delete. Styled to match the dashboard mockup: amber "New Chat" button,
 * "Recent Sessions" header, active item in amber, inactive items in slate.
 */
import type { SessionSummary, ChatKind } from '../types';
import { PlusIcon, TrashIcon } from './IconComponents';

interface SidebarProps {
  sessions: SessionSummary[];
  activeId: number | null;
  loading: boolean;
  onNew: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

/** Emoji per session kind (the mockup uses emoji icons in the list). */
function kindEmoji(kind: ChatKind): string {
  switch (kind) {
    case 'solver':
      return '🧮';
    case 'lesson':
      return '💡';
    default:
      return '💬';
  }
}

/** Today / Yesterday / date. */
function when(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const diff = now - then;
  if (diff < day && new Date(iso).getDate() === new Date(now).getDate()) return 'Today';
  if (diff < 2 * day) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Sidebar({
  sessions,
  activeId,
  loading,
  onNew,
  onSelect,
  onDelete,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onNew}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm mb-3"
      >
        <PlusIcon width={16} height={16} />
        <span className="text-sm">New Chat</span>
      </button>

      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
        Recent Sessions
      </span>

      <div className="space-y-1 overflow-y-auto flex-1 pr-1">
        {loading ? (
          <div className="space-y-2 px-2 py-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-lg">
                <span
                  className="lws-skeleton"
                  style={{ display: 'block', height: 10, width: '70%', marginBottom: 6 }}
                />
                <span
                  className="lws-skeleton"
                  style={{ display: 'block', height: 8, width: '40%' }}
                />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-slate-400 px-3 py-8 text-center">
            No conversations yet.
          </p>
        ) : (
          sessions.map((s) => {
            const active = s.id === activeId;
            return (
              <div
                key={s.id}
                data-active={active}
                className={`lws-session-item group p-3 rounded-lg cursor-pointer transition-all border ${
                  active
                    ? 'bg-amber-50/80 border-amber-200/80'
                    : 'hover:bg-slate-50 border-transparent'
                }`}
                onClick={() => onSelect(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(s.id);
                  }
                }}
                aria-pressed={active}
              >
                <div className="flex items-center gap-2">
                  <span className={active ? 'text-amber-600' : 'text-slate-400'}>
                    {kindEmoji(s.kind)}
                  </span>
                  <span
                    className={`text-xs font-bold truncate flex-grow ${
                      active ? 'text-amber-900' : 'text-slate-600'
                    }`}
                    title={s.title}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    aria-label={`Delete conversation: ${s.title}`}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </div>
                <span
                  className={`text-[10px] ml-6 block ${
                    active ? 'text-amber-700/70' : 'text-slate-400'
                  }`}
                >
                  {s.kind} · {when(s.updatedAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
