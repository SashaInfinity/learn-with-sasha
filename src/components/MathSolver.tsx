/**
 * Conversational Math Solver.
 *
 * Student types a problem OR uploads a photo of one; Sasha solves it step by
 * step and the exchange appears as a chat thread, so follow-up questions
 * ("why did you divide there?") work naturally via the same thread.
 *
 * The final answer is surfaced in a highlighted banner so it's easy to find
 * even when the working is long.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Role } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Markdown } from '../lib/markdown';
import { UploadIcon, SendIcon, SparklesIcon, BookOpenIcon } from './IconComponents';
import ThinkingIndicator from './ThinkingIndicator';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB, matches the advertised limit

interface SolverMessage {
  id: number;
  role: Role;
  text: string;
  image?: string; // data URL for display
  finalAnswer?: string;
}

export default function MathSolver() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SolverMessage[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(scrollToBottom, [messages, busy, scrollToBottom]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setImage({ base64, mimeType: file.type, preview: dataUrl });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const solve = async () => {
    if ((!input.trim() && !image) || busy) return;
    setError(null);

    const userMsg: SolverMessage = {
      id: nextId.current++,
      role: Role.USER,
      text: input.trim() || '(solve the problem in the image)',
      image: image?.preview,
    };
    setMessages((m) => [...m, userMsg]);
    const payload = {
      problemText: input.trim() || undefined,
      image: image ?? undefined,
    };
    setInput('');
    setImage(null);
    setBusy(true);

    try {
      const result = await api.solve(payload);
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          role: Role.MODEL,
          text: result.steps || result.reply,
          finalAnswer: result.finalAnswer || undefined,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to solve problem';
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: Role.MODEL, text: `Sorry — ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void solve();
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fadeInUp">
      <header className="flex items-center gap-4 mb-6">
        <BookOpenIcon
          className="w-10 h-10 animate-float"
          style={{ color: 'var(--color-accent)' }}
        />
        <div>
          <h1 className="text-3xl font-bold themed-title">Math Solver</h1>
          <p className="text-gray-400">
            Type a problem or snap a photo — Sasha solves it step by step.
          </p>
        </div>
      </header>

      {/* Thread */}
      <div
        className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-4 border mb-4 min-h-[40vh] max-h-[55vh] overflow-y-auto"
        style={{ borderColor: 'var(--color-border-surface)' }}
        role="log"
        aria-live="polite"
        aria-label="Solver conversation"
      >
        {messages.length === 0 && !busy && (
          <div className="text-center text-gray-500 py-16">
            <SparklesIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ask Sasha anything. For example:</p>
            <p className="mt-2 italic">&ldquo;What is 15% of 80?&rdquo;</p>
            <p className="italic">&ldquo;Solve 2x² + 5x - 3 = 0&rdquo;</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex my-4 animate-fadeInUp ${m.role === Role.USER ? 'justify-end' : ''}`}
          >
            {m.role === Role.MODEL && (
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-3"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
            )}
            <div
              className={`max-w-xl p-4 rounded-2xl shadow-md ${
                m.role === Role.USER
                  ? 'text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-200 rounded-bl-none'
              }`}
              style={{
                backgroundColor:
                  m.role === Role.USER ? 'var(--color-user-message-bg)' : undefined,
              }}
            >
              {m.role === Role.USER && m.image && (
                <img
                  src={m.image}
                  alt="Uploaded problem"
                  className="rounded-lg mb-2 max-w-full h-auto max-h-48"
                />
              )}
              {m.role === Role.USER ? (
                <p className="whitespace-pre-wrap">{m.text}</p>
              ) : (
                <Markdown content={m.text} />
              )}
              {m.finalAnswer && (
                <div
                  className="mt-3 p-3 rounded-lg font-bold"
                  style={{
                    backgroundColor: 'rgba(var(--color-success-rgb), 0.15)',
                    border: '1px solid var(--color-success)',
                    color: 'var(--color-success)',
                  }}
                  role="status"
                >
                  Final Answer: {m.finalAnswer}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <ThinkingIndicator />}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400 mb-2 px-2">
          {error}
        </p>
      )}

      {/* Composer */}
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-3 border" style={{ borderColor: 'var(--color-border-surface)' }}>
        {image && (
          <div className="mb-2 flex items-center gap-3 px-2">
            <img src={image.preview} alt="To send" className="h-16 w-16 object-cover rounded" />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="text-sm text-gray-400 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="sr-only"
            id="solver-file-upload"
          />
          <label
            htmlFor="solver-file-upload"
            className="p-3 rounded-full cursor-pointer transition-colors flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
            title="Upload a photo of the problem"
          >
            <UploadIcon className="w-6 h-6 text-white" />
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Paste a problem, ${user?.display_name ?? 'friend'}…`}
            rows={1}
            className="flex-grow bg-gray-700 border border-gray-600 rounded-2xl px-4 py-3 text-white resize-none focus:outline-none focus:border-[var(--color-accent)]"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => void solve()}
            disabled={busy || (!input.trim() && !image)}
            className="p-3 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
            aria-label="Solve"
          >
            <SendIcon className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
