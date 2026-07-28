/**
 * ChatHome — the post-login landing.
 *
 * A three-column layout (matching sasha_lms's .lws-grid):
 *   1. sessions sidebar (previous conversations — click to replay)
 *   2. the chat panel (current conversation)
 *   3. the 3D Sasha dock (rendered into #sasha-dock by SashaStage)
 *
 * Session lifecycle:
 *   - On mount, load the sessions list. If there are any, open the most recent.
 *   - "New chat" creates an empty 'chat' session and selects it.
 *   - Sending a message POSTs to /api/chat with the active sessionId; the
 *     backend persists both turns. Sending the first message auto-titles it.
 *   - Selecting a session loads its full message thread (the explanation
 *     history) into the chat panel.
 *   - The "Generate a lesson" action opens LessonModal; on success it posts the
 *     formatted lesson into the active chat as a model message (also persisted).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Role,
  type ChatHistoryEntry,
  type Message,
  type Preferences,
  type SessionSummary,
} from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { useToast } from '../context/ToastContext';

/** localStorage key for the most recently opened session (continuity on reload). */
const LAST_SESSION_KEY = 'lws:lastSessionId';

function rememberSession(id: number) {
  try {
    localStorage.setItem(LAST_SESSION_KEY, String(id));
  } catch {
    /* private mode / disabled storage — non-fatal */
  }
}
function recallSession(): number | null {
  try {
    const v = localStorage.getItem(LAST_SESSION_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
import { useSashaAnchor } from '../hooks/useSashaAnchor';
import { SASHA_DOCK_ID } from './learnWithSasha/constants';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import LessonModal from './LessonModal';
import { MenuIcon, PlusIcon, XIcon } from './IconComponents';

const SOLVER_HINTS = [
  'What is 15% of 80?',
  'Solve 2x² + 5x - 3 = 0',
  'Explain the Pythagorean theorem',
];

function toMessage(entry: ChatHistoryEntry): Message {
  return {
    role: entry.role,
    text: entry.text,
    image: entry.imageBase64 ? `data:image/png;base64,${entry.imageBase64}` : undefined,
  };
}

export default function ChatHome({ lessonTrigger }: { lessonTrigger: number }) {
  const { user } = useAuth();
  const { setMood } = useVoice();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  // The navbar's "Generate Lesson" CTA bumps this counter; open the modal on
  // each bump (skip the initial mount value).
  useEffect(() => {
    if (lessonTrigger > 0) setLessonOpen(true);
  }, [lessonTrigger]);
  // Saved preferences — flow into chat/solve/lesson as the remembered context
  // (language + interests) so the experience is continuous across sessions.
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  // Ref so the persistence callback always writes to the right session, even
  // across re-renders where `activeId` may not have propagated.
  const activeIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Sasha's dock. Registered as the stage anchor so the 3D character is placed
  // by layout — on desktop the mascot card, on mobile the compact strip.
  const dockRef = useRef<HTMLDivElement | null>(null);
  useSashaAnchor(dockRef, 'dock', { fillY: 0.94, max: 1.4 });

  const refreshSessions = useCallback(async () => {
    const { sessions: list } = await api.listSessions();
    setSessions(list);
    return list;
  }, []);

  // Initial load: fetch saved preferences + the sessions list, then reopen the
  // exact session the user last had open (localStorage) if it still exists —
  // falling back to the most recent. This gives seamless continuity on reload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Preferences (language/interests) in parallel with the session list.
        api
          .getPreferences()
          .then(({ preferences }) => {
            if (!cancelled && preferences) setPrefs(preferences);
          })
          .catch(() => {});

        const list = await refreshSessions();
        if (cancelled) return;
        const last = recallSession();
        const target = last && list.some((s) => s.id === last) ? last : list[0]?.id;
        if (target) await selectSession(target);
      } catch {
        /* network — leave empty */
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSession = useCallback(async (id: number) => {
    setActiveId(id);
    activeIdRef.current = id;
    rememberSession(id);
    try {
      const { messages: msgs } = await api.getSession(id);
      setMessages(msgs.map(toMessage));
    } catch {
      setMessages([]);
    }
  }, []);

  const newChat = useCallback(async () => {
    const { session } = await api.createSession('chat');
    setMessages([]);
    setActiveId(session.id);
    activeIdRef.current = session.id;
    rememberSession(session.id);
    await refreshSessions();
  }, [refreshSessions]);

  const deleteSession = useCallback(
    async (id: number) => {
      await api.deleteSession(id);
      const remaining = await refreshSessions();
      if (id === activeIdRef.current) {
        if (remaining.length) await selectSession(remaining[0].id);
        else {
          setActiveId(null);
          setMessages([]);
        }
      }
    },
    [refreshSessions, selectSession],
  );

  /** Ensure a session is active; lazily create one if the user started typing
   *  into a fresh empty state without clicking "New chat". */
  const ensureSession = useCallback(async (): Promise<number | null> => {
    if (activeIdRef.current) return activeIdRef.current;
    const { session } = await api.createSession('chat');
    setActiveId(session.id);
    activeIdRef.current = session.id;
    rememberSession(session.id);
    await refreshSessions();
    return session.id;
  }, [refreshSessions]);

  // Build the tutor context from saved preferences + the active lesson topic so
  // every Gemini call (chat/simplify/solve) replies in the student's language
  // and ties to their interests. `activeTopic`/`activeInterests` are reserved
  // for future lesson-aware chat; today prefs drive language + interests.
  const buildContext = useCallback(
    () => ({
      name: user?.display_name ?? 'there',
      topic: '',
      interests: prefs?.interests?.join(', ') ?? '',
      language: prefs?.language ?? 'English',
    }),
    [user?.display_name, prefs],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const sessionId = await ensureSession();
      if (!sessionId) return;
      setMessages((prev) => [...prev, { role: Role.USER, text }]);
      setThinking(true);
      setMood('thinking');
      try {
        const { reply } = await api.chat(sessionId, text, buildContext());
        setMessages((prev) => [...prev, { role: Role.MODEL, text: reply }]);
        void refreshSessions();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        toast(`Couldn't reach Sasha: ${msg}`, 'error');
        setMessages((prev) => [
          ...prev,
          { role: Role.MODEL, text: `Sorry — I hit an error: ${msg}. Please try again.` },
        ]);
      } finally {
        setThinking(false);
        setMood('idle');
      }
    },
    [ensureSession, refreshSessions, buildContext, setMood, toast],
  );

  const simplify = useCallback(
    async (textToSimplify: string) => {
      const sessionId = await ensureSession();
      if (!sessionId) return;
      setMessages((prev) => [
        ...prev,
        { role: Role.USER, text: `Please simplify this for me: "${textToSimplify}"` },
      ]);
      setThinking(true);
      try {
        const { reply } = await api.simplify(textToSimplify, buildContext().language);
        setMessages((prev) => [...prev, { role: Role.MODEL, text: reply }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        toast(`Couldn't simplify that: ${msg}`, 'error');
        setMessages((prev) => [
          ...prev,
          { role: Role.MODEL, text: `Sorry, I couldn't simplify that. ${msg}` },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [ensureSession, buildContext, toast],
  );

  /** LessonModal callback: drop the generated lesson into the chat as a model
   *  message and persist it via the append-message endpoint (no fake user turn,
   *  no extra Gemini call). */
  const onLesson = useCallback(
    async (formattedText: string) => {
      const sessionId = await ensureSession();
      if (!sessionId) return;
      setMessages((prev) => [...prev, { role: Role.MODEL, text: formattedText }]);
      setMood('celebrate');
      setTimeout(() => setMood('idle'), 1200);
      // Persist as a model-only turn + title the session from the lesson.
      void api.appendMessage(sessionId, {
        role: 'model',
        text: formattedText,
        title: 'Lesson',
      });
      void refreshSessions();
      // LessonModal just saved new prefs server-side; refetch so subsequent
      // chats use the updated language/interests.
      api
        .getPreferences()
        .then(({ preferences }) => preferences && setPrefs(preferences))
        .catch(() => {});
    },
    [ensureSession, refreshSessions, setMood],
  );

  return (
    <main
      className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6"
      style={{ padding: 'calc(var(--lws-header-h) + 24px) 16px 24px' }}
    >
      {/* ============ LEFT: Mascot / Tutor Status Card (lg: 4 cols) ======== */}
      <section className="lg:col-span-4 flex flex-col gap-4 lws-mascot-section">
        <div className="lws-mascot-card bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col items-center relative">
          <div className="lws-mascot-glow" />

          {/* Speech-bubble greeting */}
          <div className="lws-bubble w-full p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg">✨</span>
              <div>
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-0.5">
                  Welcome back
                </p>
                <h2 className="text-sm font-semibold text-slate-800">
                  Hi {user?.display_name ?? 'there'}! What shall we learn today?
                </h2>
              </div>
            </div>
          </div>

          {/* The 3D character projects into #sasha-dock here. */}
          <div className="lws-dock-wrap flex flex-col items-center">
            <div ref={dockRef} id={SASHA_DOCK_ID} className="lws-dock" />
            <span className="mt-4 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sasha is active
            </span>
          </div>

          {/* Tutor details */}
          <div className="text-center w-full pt-4 border-t border-slate-100">
            <h3 className="font-bold text-slate-800">Sasha</h3>
            <p className="text-xs text-slate-500">Your Interactive AI Math Tutor</p>
          </div>
        </div>
      </section>

      {/* ============ RIGHT: History + Active Chat (lg: 8 cols) ============ */}
      <section className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-100/50 p-2 rounded-2xl border border-slate-200/80">
        {/* Mobile: a menu button to open the sessions drawer. */}
        <div className="md:hidden flex items-center justify-between px-1 pb-1">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg"
            aria-label="Open conversations"
          >
            <MenuIcon width={16} height={16} />
            Sessions
          </button>
          <button
            onClick={() => setLessonOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <PlusIcon width={14} height={14} /> Lesson
          </button>
        </div>

        {/* Sessions history (md: 4 cols, fixed height) */}
        <aside className="hidden md:flex md:col-span-4 bg-white rounded-xl border border-slate-200/60 p-3 flex-col h-[650px]">
          <Sidebar
            sessions={sessions}
            activeId={activeId}
            loading={sessionsLoading}
            onNew={() => void newChat()}
            onSelect={(id) => void selectSession(id)}
            onDelete={(id) => void deleteSession(id)}
          />
        </aside>

        {/* Active chat (md: 8 cols, fixed height) */}
        <div className="md:col-span-8 h-[650px]">
          <ChatPanel
            messages={messages}
            isThinking={thinking}
            onSend={sendMessage}
            onSimplify={simplify}
            starters={SOLVER_HINTS}
            title={
              activeId
                ? (sessions.find((s) => s.id === activeId)?.title ?? 'New chat')
                : 'New chat'
            }
            placeholder={
              activeId
                ? 'Type your question...'
                : 'Ask Sasha anything — a math problem, a concept, anything.'
            }
          />
        </div>
      </section>

      {/* Mobile sessions drawer */}
      {drawerOpen && (
        <div className="lws-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside
            className="lws-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Conversations"
          >
            <div className="lws-drawer-header">
              <span className="font-bold text-slate-800">Conversations</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100"
                aria-label="Close conversations"
              >
                <XIcon width={18} height={18} />
              </button>
            </div>
            <Sidebar
              sessions={sessions}
              activeId={activeId}
              loading={sessionsLoading}
              onNew={() => {
                void newChat();
                setDrawerOpen(false);
              }}
              onSelect={(id) => {
                void selectSession(id);
                setDrawerOpen(false);
              }}
              onDelete={(id) => void deleteSession(id)}
            />
          </aside>
        </div>
      )}

      <LessonModal
        isOpen={lessonOpen}
        onClose={() => setLessonOpen(false)}
        onLesson={(text) => void onLesson(text)}
      />
    </main>
  );
}
