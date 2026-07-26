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
import { Role, type ChatHistoryEntry, type ChatKind, type Message, type SessionSummary } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import LessonModal from './LessonModal';
import { BookOpenIcon, SparklesIcon } from './IconComponents';

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
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [kind, setKind] = useState<ChatKind>('chat');
  const [lessonOpen, setLessonOpen] = useState(false);
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

  // Initial load: list sessions, open the most recent if any (else none — the
  // empty state invites a new chat).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refreshSessions();
        if (cancelled) return;
        if (list.length) await selectSession(list[0].id);
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
    await refreshSessions();
    return session.id;
  }, [refreshSessions]);

  const sendMessage = useCallback(
    async (text: string) => {
      const sessionId = await ensureSession();
      if (!sessionId) return;
      setMessages((prev) => [...prev, { role: Role.USER, text }]);
      setThinking(true);
      setMood('thinking');
      try {
        const { reply } = await api.chat(sessionId, text, {
          name: user?.display_name ?? 'there',
          topic: '',
          interests: '',
        });
        setMessages((prev) => [...prev, { role: Role.MODEL, text: reply }]);
        // mood flips to 'talking' automatically when TTS starts; revert to idle
        // otherwise.
        void refreshSessions();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        setMessages((prev) => [
          ...prev,
          { role: Role.MODEL, text: `Sorry — I hit an error: ${msg}` },
        ]);
      } finally {
        setThinking(false);
        setMood('idle');
      }
    },
    [ensureSession, refreshSessions, user?.display_name, setMood],
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
        const { reply } = await api.simplify(textToSimplify);
        setMessages((prev) => [...prev, { role: Role.MODEL, text: reply }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        setMessages((prev) => [
          ...prev,
          { role: Role.MODEL, text: `Sorry, I couldn't simplify that. ${msg}` },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [ensureSession],
  );

  /** LessonModal callback: drop the generated lesson into the chat as a model
   *  message and persist it so it shows in the sidebar thread. */
  const onLesson = useCallback(
    async (formattedText: string) => {
      const sessionId = await ensureSession();
      if (!sessionId) return;
      setMessages((prev) => [...prev, { role: Role.MODEL, text: formattedText }]);
      // Celebrate, then settle.
      setMood('celebrate');
      setTimeout(() => setMood('idle'), 1200);
      // Persist the model turn so it survives reload. Reuse the chat endpoint's
      // shape by sending a tiny "save-only" message via chat — simplest path is
      // a direct chat turn the user can continue from.
      void api.chat(sessionId, 'Show me the lesson you generated.', {
        name: user?.display_name ?? 'there',
        topic: '',
        interests: '',
      });
      void refreshSessions();
    },
    [ensureSession, refreshSessions, user?.display_name, setMood],
  );

  return (
    <div className="lws-container lws-page">
      <div className="lws-grid">
        {/* Dock column: the 3D Sasha character + a speech bubble. */}
        <div className="lws-dock-col">
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
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
          >
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)',
              }}
            >
              <div style={{ height: '72vh' }}>
                <Sidebar
                  sessions={sessions}
                  activeId={activeId}
                  loading={sessionsLoading}
                  onNew={() => void newChat()}
                  onSelect={(id) => void selectSession(id)}
                  onDelete={(id) => void deleteSession(id)}
                />
              </div>

              <div className="flex flex-col" style={{ height: '72vh' }}>
                {/* Action strip above the chat panel. */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="lws-label-tag" style={{ margin: 0 }}>
                    {kind === 'solver' ? 'Math solver' : kind === 'lesson' ? 'Lesson' : 'Chat'}
                  </span>
                  <button
                    onClick={() => setLessonOpen(true)}
                    className="lws-btn lws-btn-ghost lws-btn-sm"
                  >
                    <BookOpenIcon width={16} height={16} />
                    Generate a lesson
                  </button>
                </div>
                <div className="flex-grow">
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
