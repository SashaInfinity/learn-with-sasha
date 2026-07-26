/**
 * LessonModal — the "Generate a structured lesson" action.
 *
 * Replaces the old 3-step wizard. Captures topic + interests + language
 * (preferences pre-filled), calls /api/lesson, and hands the result back as a
 * richly-formatted message the parent drops into the chat thread.
 *
 * On success it also persists the student's interests/language so the next
 * visit pre-fills them.
 */
import { useEffect, useState } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { useToast } from '../context/ToastContext';
import type { Preferences } from '../types';
import { BookOpenIcon } from './IconComponents';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the markdown-formatted lesson text to append to the chat. */
  onLesson: (formattedText: string) => void;
}

export default function LessonModal({ isOpen, onClose, onLesson }: LessonModalProps) {
  const { user } = useAuth();
  const { setMood } = useVoice();
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [interests, setInterests] = useState('');
  const [language, setLanguage] = useState('English');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill interests/language from saved preferences when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    api
      .getPreferences()
      .then(({ preferences }: { preferences: Preferences | null }) => {
        if (!preferences) return;
        setInterests((prev) =>
          prev
            ? prev
            : Array.isArray(preferences.interests) && preferences.interests.length
              ? preferences.interests.join(', ')
              : '',
        );
        if (preferences.language) setLanguage(preferences.language);
      })
      .catch(() => {
        /* not logged in or no prefs yet */
      });
  }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || busy) return;
    setBusy(true);
    setError(null);
    // Sasha thinks hard while the lesson is being generated (long operation).
    setMood('thinking');
    try {
      const name = user?.display_name ?? 'there';
      const result = await api.generateLesson({
        name,
        interests: interests.trim(),
        topic: topic.trim(),
        language,
        hasUploadedNote: false,
      });
      // Persist preferences for next time.
      void api.savePreferences({
        interests: interests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        language,
      });
      // Render the lesson as a single rich Sasha message.
      const { lesson, quiz } = result;
      const parts: string[] = [];
      if (lesson.overview) parts.push(`**Concept Overview**\n${lesson.overview}`);
      if (lesson.explanation)
        parts.push(`**Personalized Explanation**\n${lesson.explanation}`);
      if (lesson.visualIdea) parts.push(`**Illustration Idea**\n${lesson.visualIdea}`);
      if (lesson.keyPoints.length) {
        parts.push(`**Key Points**\n${lesson.keyPoints.map((p) => `- ${p}`).join('\n')}`);
      }
      if (quiz.length) {
        parts.push(
          `**Quick Check**\n${quiz
            .map(
              (q, i) =>
                `${i + 1}. ${q.question}\n` +
                q.options.map((o, j) => `   - ${String.fromCharCode(65 + j)}. ${o}`).join('\n'),
            )
            .join('\n')}`,
        );
      }
      onLesson(parts.join('\n\n'));
      setTopic('');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate lesson';
      setError(msg);
      toast(`Couldn't generate the lesson: ${msg}`, 'error');
      setMood('idle'); // reset thinking mood on failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate a lesson">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
            <BookOpenIcon width={20} height={20} />
          </span>
          <p className="text-xs text-slate-500">
            Pick a topic and Sasha will craft a personalized lesson tied to your interests.
          </p>
        </div>

        <div>
          <label htmlFor="lesson-topic" className="block text-sm font-semibold text-slate-700 mb-1.5">
            What would you like to learn?
          </label>
          <input
            id="lesson-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Algebra, Probability, Calculus"
            required
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        <div>
          <label htmlFor="lesson-interests" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Your interests
          </label>
          <input
            id="lesson-interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g. football, music, gaming"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        <div>
          <label htmlFor="lesson-language" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Language
          </label>
          <select
            id="lesson-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          >
            <option>English</option>
            <option>Tamil</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !topic.trim()}
            className="flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
          >
            {busy && <Spinner size="sm" />}
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
