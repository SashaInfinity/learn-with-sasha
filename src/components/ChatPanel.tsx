/**
 * ChatPanel — the active conversation surface, styled per the dashboard mockup.
 *
 * Structure: header (status dot + title + voice toggle) → scrollable messages
 * (amber user bubbles, AI messages with avatar + Speak/Simplify action bar) →
 * input row with an amber send button.
 *
 * Session lifecycle lives in the parent (ChatHome); this is a controlled view.
 */
import { useEffect, useRef, useState } from 'react';
import { Role, type Message } from '../types';
import { useVoice } from '../context/VoiceContext';
import { SendIcon, SparklesIcon, MagicWandIcon, SpeakerIcon } from './IconComponents';
import VoiceControlPanel from './VoiceControlPanel';
import { Markdown } from '../lib/markdown';

const SashaAvatar = () => (
  <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 mt-1">
    <SparklesIcon width={16} height={16} />
  </div>
);

const ThinkingIndicator = () => (
  <div className="flex items-start gap-3 my-3">
    <SashaAvatar />
    <div className="bg-slate-50 border border-slate-200/70 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
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
      <div className="flex justify-end">
        <div className="bg-amber-500 text-white font-medium px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm text-sm">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <SashaAvatar />
      <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-2xl rounded-tl-sm max-w-[90%] text-slate-800 space-y-2 leading-relaxed text-sm">
        <div className="lws-markdown">
          <Markdown content={message.text} />
        </div>
        {message.finalAnswer && (
          <div className="bg-amber-100/60 border-l-4 border-amber-500 p-2.5 rounded-r-md text-center font-bold text-amber-950 text-sm">
            {message.finalAnswer}
          </div>
        )}
        {/* Action bar */}
        <div className="flex items-center gap-4 pt-2 text-xs text-slate-400 border-t border-slate-200/50">
          <button
            onClick={() => onSpeak(message.text)}
            className="hover:text-amber-600 flex items-center gap-1 font-medium"
          >
            <SpeakerIcon width={13} height={13} /> Speak
          </button>
          <button
            onClick={() => onSimplify(message.text)}
            className="hover:text-amber-600 flex items-center gap-1 font-medium"
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
    <div className="bg-white rounded-xl border border-slate-200/60 flex flex-col h-full shadow-sm overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0" />
          <span className="text-xs font-bold text-slate-700 truncate">{title}</span>
        </div>
        <VoiceControlPanel />
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
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-3">
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
