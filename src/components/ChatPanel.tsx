/**
 * ChatPanel — the active conversation surface, styled per the dashboard mockup.
 *
 * Structure: header (status dot + title + voice toggle) → scrollable messages
 * (amber user bubbles, AI messages with avatar + Speak/Simplify action bar) →
 * input row with an amber send button.
 *
 * Session lifecycle lives in the parent (ChatHome); this is a controlled view.
 * Surfaces consume the shared --lws-* tokens via .lws-chat-surface /
 * .lws-bubble-user / .lws-bubble-sasha so the dashboard stays visually in sync
 * with the landing page.
 */
import { useEffect, useRef, useState } from 'react';
import { Role, type Message } from '../types';
import { useVoice } from '../context/VoiceContext';
import { SendIcon, SparklesIcon, MagicWandIcon, SpeakerIcon } from './IconComponents';
import VoiceControlPanel from './VoiceControlPanel';
import { Markdown } from '../lib/markdown';

const SashaAvatar = () => (
  <span className="lws-avatar-sm lws-message-avatar" aria-hidden>
    <SparklesIcon width={16} height={16} />
  </span>
);

const ThinkingIndicator = () => (
  <div className="lws-message-in flex items-start gap-3">
    <SashaAvatar />
    <div className="lws-bubble-sasha lws-thinking flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  </div>
);

interface ChatMessageProps {
  message: Message;
  onSimplify: (text: string) => void;
  onSpeak: (text: string) => void;
}

const ChatMessage = ({ message, onSimplify, onSpeak }: ChatMessageProps) => {
  const isUser = message.role === Role.USER;
  if (isUser) {
    return (
      <div className="lws-message-in flex justify-end">
        <div className="lws-bubble-user text-sm">{message.text}</div>
      </div>
    );
  }
  return (
    <div className="lws-message-in flex items-start gap-3">
      <SashaAvatar />
      <div className="lws-bubble-sasha text-slate-800 space-y-2 leading-relaxed text-sm">
        <div className="lws-markdown">
          <Markdown content={message.text} />
        </div>
        {message.finalAnswer && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-md text-center font-bold text-amber-950 text-sm">
            {message.finalAnswer}
          </div>
        )}
        {/* Action bar */}
        <div className="flex items-center gap-1 pt-2 text-xs border-t border-slate-100">
          <button
            onClick={() => onSpeak(message.text)}
            className="lws-icon-btn"
            title="Read this answer aloud"
          >
            <SpeakerIcon width={13} height={13} /> Speak
          </button>
          <button
            onClick={() => onSimplify(message.text)}
            className="lws-icon-btn"
            title="Simplify this explanation"
          >
            <MagicWandIcon width={13} height={13} /> Simplify
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSend: (text: string) => void;
  onSimplify: (text: string) => void;
  starters?: string[];
  title?: string;
  placeholder?: string;
}

const DEFAULT_STARTERS = [
  'Can you give another example?',
  'Why does that work?',
  'Where is this used?',
];

export default function ChatPanel({
  messages,
  isThinking,
  onSend,
  onSimplify,
  starters = DEFAULT_STARTERS,
  title = 'New chat',
  placeholder = 'Type your question...',
}: ChatPanelProps) {
  const { speak, muted, setMood } = useVoice();
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const lastSpokenIdx = useRef(-1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    if (muted || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const lastIdx = messages.length - 1;
    if (
      last.role === Role.MODEL &&
      lastIdx !== lastSpokenIdx.current &&
      last.text.length > 0 &&
      last.text.length <= 600
    ) {
      lastSpokenIdx.current = lastIdx;
      speak(last.text);
    }
  }, [messages, muted, speak]);

  const submit = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="lws-chat-surface flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0" />
          <span className="text-sm font-semibold text-slate-700 truncate">{title}</span>
        </div>
        <div className="shrink-0">
          <VoiceControlPanel />
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 p-4 overflow-y-auto space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Conversation with Sasha"
      >
        {messages.length === 0 && !isThinking && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div
              className="lws-avatar-sm mb-3"
              style={{ width: 48, height: 48, borderRadius: 14 }}
            >
              <SparklesIcon width={22} height={22} />
            </div>
            <p className="text-sm text-slate-500 mb-4 max-w-xs">
              Stuck on something? Ask Sasha anything.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  onClick={() => onSend(starter)}
                  className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage
            key={`${index}-${msg.role}-${msg.text.slice(0, 12)}`}
            message={msg}
            onSimplify={onSimplify}
            onSpeak={speak}
          />
        ))}
        {isThinking && <ThinkingIndicator />}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-100">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setMood('attentive')}
            onBlur={() => setMood('idle')}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={placeholder}
            disabled={isThinking}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-60"
          />
          <button
            onClick={submit}
            disabled={isThinking || !input.trim()}
            aria-label="Send question"
            className="absolute right-2 p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:bg-slate-300"
          >
            <SendIcon width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
