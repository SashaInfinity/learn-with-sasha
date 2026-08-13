/**
 * Sidebar — the sessions rail.
 *
 * Lists previous conversations grouped by date (Today / Yesterday / Earlier),
 * lets the student start a new one, switch, and delete. Styled to match the
 * dashboard mockup: amber "New Chat" button, active item with an amber accent,
 * inactive items in slate. Consumes the shared .lws-session-item /
 * .lws-session-group-label / .lws-skeleton-row token classes.
 */
import { useMemo } from 'react';
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

/** Bucket label for date grouping: Today / Yesterday / Earlier. */
function bucket(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const diff = now - then;
  if (diff < day && new Date(iso).getDate() === new Date(now).getDate()) return 'Today';
  if (diff < 2 * day) return 'Yesterday';
  return 'Earlier';
}

/** Relative timestamp shown on each row. */
function when(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const diff = now - then;
  if (diff < day && new Date(iso).getDate() === new Date(now).getDate())
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
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
  // Group sessions into ordered buckets while preserving recency sort.
  const groups = useMemo(() => {
    const order = ['Today', 'Yesterday', 'Earlier'];
    const map = new Map<string, SessionSummary[]>();
    for (const s of sessions) {
      const b = bucket(s.updatedAt);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(s);
    }
    return order
      .filter((label) => map.has(label))
      .map((label) => ({ label, items: map.get(label)! }));
  }, [sessions]);

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onNew}
        className="lws-cta lws-lift w-full mb-3"
        style={{ padding: '10px var(--lws-space-4)', fontSize: 14 }}
      >
        <PlusIcon width={16} height={16} />
        <span>New Chat</span>
      </button>

      <div className="overflow-y-auto flex-1 pr-1 -mr-1">
        {loading ? (
          <div className="space-y-3 px-2 py-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-lg border border-transparent">
                <span
                  className="lws-skeleton lws-skeleton-row"
                  style={{ width: '70%' }}
                />
                <span
                  className="lws-skeleton lws-skeleton-row"
                  style={{ width: '40%' }}
                />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm font-medium text-slate-500 mb-1">
              No conversations yet
            </p>
            <p className="text-xs text-slate-400">Start a New Chat to begin.</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="lws-session-group-label">{group.label}</div>
              {group.items.map((s) => {
                const active = s.id === activeId;
                return (
                  <div
                    key={s.id}
                    data-active={active}
                    className={`lws-session-item group p-2.5 px-3 rounded-lg cursor-pointer border ${
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
                        className="lws-icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100"
                        style={{ padding: 4 }}
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                    <span
                      className={`text-[10px] ml-6 block mt-0.5 ${
                        active ? 'text-amber-700/70' : 'text-slate-400'
                      }`}
                    >
                      {s.kind} · {when(s.updatedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
