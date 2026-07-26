/**
 * ChatPanel — the Q&A surface. Ported from sasha_lms's learn-with-sasha module
 * and re-themed to the brand tokens. Uses our DOMPurify-backed Markdown
 * renderer (src/lib/markdown) and our hand-rolled icons (no lucide-react dep).
 *
 * Session lifecycle (creating/saving/loading) lives in the parent (ChatHome);
 * this component is a controlled view of `messages` + callbacks.
 */
import { useEffect, useRef, useState } from 'react';
import { Role, type Message } from '../types';
import { useVoice } from '../context/VoiceContext';
import { SendIcon, SparklesIcon, MagicWandIcon, SpeakerIcon } from './IconComponents';
import VoiceControlPanel from './VoiceControlPanel';
import { Markdown } from '../lib/markdown';

const SashaAvatar = () => (
  <div
    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]"
    style={{ background: 'var(--lws-primary)' }}
    aria-hidden
  >
    <SparklesIcon className="text-white" width={15} height={15} />
  </div>
);

const ThinkingIndicator = () => (
  <div className="lws-fade-in-up my-4 flex items-start gap-3">
    <SashaAvatar />
    <div
      className="flex items-center rounded-2xl rounded-bl-md px-4 py-3.5"
      style={{
        background: 'rgba(200, 150, 90, 0.1)',
        border: '1px solid var(--lws-glass-border)',
      }}
      role="status"
      aria-label="Sasha is thinking"
    >
      <div className="flex items-center space-x-1.5">
        <div className="lws-thinking-dot" />
        <div className="lws-thinking-dot" style={{ animationDelay: '0.2s' }} />
        <div className="lws-thinking-dot" style={{ animationDelay: '0.4s' }} />
      </div>
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
  return (
    <div className={`lws-fade-in-up my-4 flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <SashaAvatar />}
      <div
        className={`max-w-xl px-4 py-3 ${
          isUser ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'
        }`}
        style={{
          background: isUser ? 'var(--lws-primary)' : 'rgba(200, 150, 90, 0.1)',
          color: isUser ? '#ffffff' : 'var(--lws-body)',
          border: isUser ? undefined : '1px solid var(--lws-glass-border)',
          fontSize: '14px',
          lineHeight: 1.65,
        }}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        ) : (
          <Markdown content={message.text} />
        )}
        {message.image && (
          <img
            src={message.image}
            alt="Uploaded problem"
            className="mt-3 max-h-48 max-w-full rounded-lg"
          />
        )}
        {!isUser && message.finalAnswer && (
          <div
            className="mt-3 rounded-md border px-3 py-2 text-sm font-bold"
            style={{
              color: 'var(--lws-success)',
              background: 'rgba(var(--lws-success-rgb), 0.1)',
              borderColor: 'var(--lws-success)',
            }}
            role="status"
          >
            Final Answer: {message.finalAnswer}
          </div>
        )}
        {!isUser && message.text && (
          <div
            className="mt-3 flex items-center gap-4 border-t pt-2.5"
            style={{ borderColor: 'var(--lws-glass-border)' }}
          >
            <button
              onClick={() => onSpeak(message.text)}
              aria-label="Speak this reply"
              className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--lws-primary)' }}
            >
              <SpeakerIcon width={13} height={13} />
              Speak
            </button>
            <button
              onClick={() => onSimplify(message.text)}
              className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--lws-primary)' }}
            >
              <MagicWandIcon width={13} height={13} />
              Simplify
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSend: (text: string) => void;
  onSimplify: (text: string) => void;
  /** Optional starter prompts shown when the thread is empty. */
  starters?: string[];
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
  placeholder = 'Type your question…',
}: ChatPanelProps) {
  const { speak, muted } = useVoice();
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  // Track the last message we auto-spoke so we don't replay on re-renders.
  const lastSpokenIdx = useRef(-1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Auto-speak a brand-new model reply (only the latest, only once, only if
  // not muted, only for plain text replies — skip the giant lesson dumps).
  useEffect(() => {
    if (muted || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const lastIdx = messages.length - 1;
    if (
      last.role === Role.MODEL &&
      lastIdx !== lastSpokenIdx.current &&
      last.text.length > 0 &&
      last.text.length <= 600 // skip very long lesson-formatted replies
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
    <div className="lws-panel flex h-full flex-col p-5">
      {/* Header row: voice controls (mute + transport + sliders). */}
      <div className="mb-3 flex items-center justify-end">
        <VoiceControlPanel />
      </div>
      <div className="mb-4 flex-grow overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Conversation with Sasha">
        {messages.length === 0 && !isThinking && (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="lws-small mb-5 max-w-xs">
              Stuck on something? Ask Sasha anything.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  onClick={() => onSend(starter)}
                  className="lws-btn lws-btn-ghost lws-btn-sm"
                  style={{ fontSize: '12px' }}
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

      <div className="relative mt-auto">
        <label htmlFor="lws-chat-input" className="sr-only">
          Ask Sasha a question
        </label>
        <input
          id="lws-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          disabled={isThinking}
          className="lws-field pr-12"
        />
        <button
          onClick={submit}
          disabled={isThinking || !input.trim()}
          aria-label="Send question"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[9px] p-2 transition-colors disabled:bg-gray-200"
          style={{
            background: isThinking || !input.trim() ? undefined : 'var(--lws-primary)',
          }}
        >
          <SendIcon className="text-white" width={15} height={15} />
        </button>
      </div>
    </div>
  );
}
