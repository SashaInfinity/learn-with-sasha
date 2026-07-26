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
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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
      setError(e instanceof Error ? e.message : 'Failed to generate lesson');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate a lesson">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="lws-icon-chip">
            <BookOpenIcon width={20} height={20} />
          </span>
          <p className="lws-small">
            Pick a topic and Sasha will craft a personalized lesson tied to your interests.
          </p>
        </div>

        <div>
          <label htmlFor="lesson-topic" className="lws-field-label">
            What would you like to learn?
          </label>
          <input
            id="lesson-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Algebra, Probability, Calculus"
            required
            autoFocus
            className="lws-field"
          />
        </div>

        <div>
          <label htmlFor="lesson-interests" className="lws-field-label">
            Your interests
          </label>
          <input
            id="lesson-interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g. football, music, gaming"
            className="lws-field"
          />
        </div>

        <div>
          <label htmlFor="lesson-language" className="lws-field-label">
            Language
          </label>
          <select
            id="lesson-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="lws-field"
          >
            <option>English</option>
            <option>Tamil</option>
          </select>
        </div>

        {error && (
          <p
            role="alert"
            className="lws-small rounded-md border px-3 py-2"
            style={{
              color: 'var(--lws-danger)',
              background: 'rgba(var(--lws-danger-rgb), 0.08)',
              borderColor: 'rgba(var(--lws-danger-rgb), 0.3)',
            }}
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="lws-btn lws-btn-ghost lws-btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={busy || !topic.trim()} className="lws-btn lws-btn-fill lws-btn-sm">
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
