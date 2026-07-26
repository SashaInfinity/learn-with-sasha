/**
 * Sidebar — the sessions rail.
 *
 * Lists previous conversations (chats / solves), lets the student start a new
 * one, switch between them, and delete. This is the "previous sessions with
 * the needed explanation" surface: clicking a session reloads its full thread.
 */
import type { SessionSummary, ChatKind } from '../types';
import { PlusIcon, TrashIcon, SparklesIcon, CalculatorIcon, BookOpenIcon } from './IconComponents';

interface SidebarProps {
  sessions: SessionSummary[];
  activeId: number | null;
  loading: boolean;
  onNew: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

/** Pick a small glyph + label hint per session kind. */
function kindMeta(kind: ChatKind): { icon: typeof SparklesIcon; hint: string } {
  switch (kind) {
    case 'solver':
      return { icon: CalculatorIcon, hint: 'Math solver' };
    case 'lesson':
      return { icon: BookOpenIcon, hint: 'Lesson' };
    default:
      return { icon: SparklesIcon, hint: 'Chat' };
  }
}

/** Human-friendly relative-ish timestamp (today/yesterday/date). */
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
    <aside
      className="lws-panel flex h-full flex-col p-4"
      aria-label="Previous conversations"
    >
      <button onClick={onNew} className="lws-btn lws-btn-fill lws-btn-sm mb-4 w-full">
        <PlusIcon width={16} height={16} />
        New chat
      </button>

      <div className="flex-grow overflow-y-auto pr-1">
        {loading ? (
          <p className="lws-small px-2 py-4 text-center">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="lws-small px-2 py-8 text-center" style={{ color: 'var(--lws-gray-light)' }}>
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => {
              const meta = kindMeta(s.kind);
              const Icon = meta.icon;
              const active = s.id === activeId;
              return (
                <li key={s.id}>
                  <div
                    className="group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all"
                    style={{
                      cursor: 'pointer',
                      background: active ? 'var(--lws-tint)' : 'transparent',
                      borderColor: active ? 'var(--lws-tint-border)' : 'transparent',
                    }}
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
                    <span
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: active ? 'var(--lws-primary)' : 'rgba(200,150,90,0.12)',
                        color: active ? '#fff' : 'var(--lws-primary)',
                      }}
                    >
                      <Icon width={14} height={14} />
                    </span>
                    <div className="min-w-0 flex-grow">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--lws-dark)' }}
                        title={s.title}
                      >
                        {s.title}
                      </p>
                      <p className="lws-small" style={{ fontSize: '11px' }}>
                        {meta.hint} · {when(s.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(s.id);
                      }}
                      aria-label={`Delete conversation: ${s.title}`}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: 'var(--lws-gray)' }}
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
