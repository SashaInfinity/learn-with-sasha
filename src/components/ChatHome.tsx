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
import { Role, type ChatHistoryEntry, type ChatKind, type Message, type Preferences, type SessionSummary } from '../types';
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
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import LessonModal from './LessonModal';
import { BookOpenIcon, SparklesIcon, MenuIcon, XIcon } from './IconComponents';

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

export default function ChatHome() {
  const { user } = useAuth();
  const { setMood } = useVoice();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [kind, setKind] = useState<ChatKind>('chat');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  // Saved preferences — flow into chat/solve/lesson as the remembered context
  // (language + interests) so the experience is continuous across sessions.
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  // Ref so the persistence callback always writes to the right session, even
  // across re-renders where `activeId` may not have propagated.
  const activeIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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
        const target =
          last && list.some((s) => s.id === last) ? last : list[0]?.id;
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
      const { session, messages: msgs } = await api.getSession(id);
      setKind(session.kind);
      setMessages(msgs.map(toMessage));
    } catch {
      setMessages([]);
    }
  }, []);

  const newChat = useCallback(async () => {
    const { session } = await api.createSession('chat');
    setKind('chat');
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
    setKind('chat');
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
    <div className="lws-container lws-page lws-chat-shell">
      <div className="lws-grid">
        {/* Dock column: the 3D Sasha character + a speech bubble.
            Hidden below lg (mobile/tablet) where she'd crowd the chat. */}
        <div className="lws-dock-col lws-hide-below-lg">
          <div className="lws-bubble-slot">
            <div className="lws-bubble">
              <SparklesIcon className="lws-bubble-icon" width={17} height={17} />
              <span className="lws-bubble-text">
                Hi {user?.display_name ?? 'there'}! What shall we learn today?
              </span>
            </div>
          </div>
          <div className="lws-sasha-frame">
            <div id="sasha-dock" className="lws-dock" />
            <p className="lws-sasha-caption lws-small">Sasha · your AI tutor</p>
          </div>
        </div>

        {/* Content column: sidebar + chat. */}
        <div className="lws-content-col">
          {/* Action strip above the chat panel. The menu button (mobile only)
              opens the sessions drawer. */}
          <div className="lws-chat-toolbar">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lws-icon-btn lws-show-below-lg"
              aria-label="Open conversations"
            >
              <MenuIcon width={18} height={18} />
            </button>
            <span className="lws-label-tag" style={{ margin: 0 }}>
              {kind === 'solver' ? 'Math solver' : kind === 'lesson' ? 'Lesson' : 'Chat'}
            </span>
            <button
              onClick={() => setLessonOpen(true)}
              className="lws-btn lws-btn-ghost lws-btn-sm lws-chat-toolbar-action"
            >
              <BookOpenIcon width={16} height={16} />
              <span className="lws-hide-below-sm">Generate a lesson</span>
              <span className="lws-show-below-sm">Lesson</span>
            </button>
          </div>

          <div className="lws-chat-body">
            {/* Desktop sidebar: a persistent left column. */}
            <aside className="lws-sidebar-desktop lws-hide-below-lg">
              <Sidebar
                sessions={sessions}
                activeId={activeId}
                loading={sessionsLoading}
                onNew={() => void newChat()}
                onSelect={(id) => void selectSession(id)}
                onDelete={(id) => void deleteSession(id)}
              />
            </aside>

            {/* Mobile drawer: slides over the chat when toggled. */}
            {drawerOpen && (
              <div className="lws-drawer-overlay" onClick={() => setDrawerOpen(false)}>
                <aside
                  className="lws-drawer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Conversations"
                >
                  <div className="lws-drawer-header">
                    <span className="lws-h3">Conversations</span>
                    <button
                      onClick={() => setDrawerOpen(false)}
                      className="lws-icon-btn"
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

            <div className="lws-chat-main">
              <ChatPanel
                messages={messages}
                isThinking={thinking}
                onSend={sendMessage}
                onSimplify={simplify}
                starters={SOLVER_HINTS}
                placeholder={
                  activeId
                    ? 'Type your question…'
                    : 'Ask Sasha anything — a math problem, a concept, anything.'
                }
              />
            </div>
          </div>
        </div>
      </div>

      <LessonModal
        isOpen={lessonOpen}
        onClose={() => setLessonOpen(false)}
        onLesson={(text) => void onLesson(text)}
      />
    </div>
  );
}
