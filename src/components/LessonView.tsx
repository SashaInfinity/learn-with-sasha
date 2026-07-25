/**
 * LessonView: the personalized lesson flow (setup -> loading -> lesson + chat).
 *
 * Refactored from the original god-component App.tsx. Key changes:
 *  - All Gemini calls now go through the backend proxy (src/lib/api) instead of
 *    the client-side @google/genai SDK, so no API key touches the browser.
 *  - Preference persistence: on successful setup, preferences are saved; if the
 *    student already has saved interests, the setup wizard is pre-filled.
 *  - Authenticated: uses the logged-in user's name from context.
 *
 * The realtime-voice feature is intentionally kept but disabled (it still
 * requires a client-side key + Live API, which is out of scope until a
 * WebSocket proxy is added). It renders no UI when no key is present.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Role, LearningState, FileData, QuizQuestion, LessonContent } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { BookOpenIcon } from './IconComponents';
import LoadingSpinner from './LoadingSpinner';
import AnimatedTitle from './AnimatedTitle';
import MultiStepSetup from './MultiStepSetup';
import LearningDashboard from './LearningDashboard';
import ChatPanel from './ChatPanel';
import StoryModal from './StoryModal';

// Sentinel for "no current lesson topic yet".
const NO_TOPIC = '';

export default function LessonView() {
  const { user } = useAuth();
  const [learningState, setLearningState] = useState<LearningState>(LearningState.SETUP);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isSashaThinking, setIsSashaThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<QuizQuestion[] | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState(NO_TOPIC);
  const [activeInterests, setActiveInterests] = useState('');

  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(scrollToBottom, [messages, isSashaThinking, scrollToBottom]);

  const handleStartLearning = async (
    name: string,
    interests: string,
    topic: string,
    uploadedFile: FileData | null,
    lang: string,
  ) => {
    setLearningState(LearningState.LOADING);
    setError(null);
    setQuizData(null);
    setLessonContent(null);
    setActiveTopic(topic);
    setActiveInterests(interests);

    try {
      const result = await api.generateLesson({
        name,
        interests,
        topic,
        language: lang,
        hasUploadedNote: !!uploadedFile,
      });
      setLessonContent(result.lesson);
      setQuizData(result.quiz);
      // Persist preferences so the wizard is pre-filled next time.
      void api.savePreferences({
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
        language: lang,
      });
      setLearningState(LearningState.LEARNING);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      setError(`An error occurred: ${msg}`);
      setLearningState(LearningState.ERROR);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSashaThinking) return;

    const userMessage: Message = { role: Role.USER, text };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentInput('');
    setIsSashaThinking(true);

    try {
      const { reply } = await api.chat(text, {
        name: user?.display_name ?? 'there',
        topic: activeTopic,
        interests: activeInterests,
      });
      setMessages((prev) => [...prev, { role: Role.MODEL, text: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      setMessages((prev) => [
        ...prev,
        { role: Role.MODEL, text: `Sorry, I encountered an error. ${msg}` },
      ]);
    } finally {
      setIsSashaThinking(false);
    }
  };

  const handleSimplify = async (textToSimplify: string) => {
    if (isSashaThinking) return;
    setMessages((prev) => [
      ...prev,
      { role: Role.USER, text: `Please simplify this for me: "${textToSimplify}"` },
    ]);
    setIsSashaThinking(true);
    try {
      const { reply } = await api.simplify(textToSimplify);
      setMessages((prev) => [...prev, { role: Role.MODEL, text: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      setMessages((prev) => [
        ...prev,
        { role: Role.MODEL, text: `Sorry, I couldn't simplify that right now. ${msg}` },
      ]);
    } finally {
      setIsSashaThinking(false);
    }
  };

  // Voice interaction is disabled until a WebSocket proxy is added (it would
  // otherwise require a client-side key). This is a no-op stub so the ChatPanel
  // contract is satisfied without leaking a key.
  const handleVoiceInteraction = useCallback(() => {
    setError('Voice interaction is temporarily unavailable.');
  }, []);

  const handleStoryOverview = () => setIsStoryModalOpen(true);

  const renderContent = () => {
    switch (learningState) {
      case LearningState.SETUP:
        return <MultiStepSetup onStart={handleStartLearning} initialName={user?.display_name} />;
      case LearningState.LOADING:
        return <LoadingSpinner />;
      case LearningState.LEARNING:
        return (
          <div className="flex flex-col lg:flex-row gap-8 max-w-screen-2xl mx-auto px-4 py-8 animate-fadeInUp">
            <div className="lg:w-2/3">
              <header className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <BookOpenIcon
                    className="w-10 h-10 animate-float"
                    style={{ color: 'var(--color-accent)' }}
                  />
                  <AnimatedTitle
                    text={`Here's Your Lesson, ${user?.display_name ?? 'friend'}`}
                    className="text-3xl"
                  />
                </div>
              </header>
              {lessonContent && (
                <LearningDashboard
                  content={lessonContent}
                  quizData={quizData}
                  onStoryOverview={handleStoryOverview}
                />
              )}
            </div>
            <div className="lg:w-1/3 lg:sticky lg:top-8 h-[70vh] lg:h-[calc(100vh-4rem)]">
              <ChatPanel
                messages={messages}
                onSimplify={handleSimplify}
                isSashaThinking={isSashaThinking}
                liveUserInput=""
                endOfMessagesRef={endOfMessagesRef}
                isRecording={false}
                handleVoiceInteraction={handleVoiceInteraction}
                currentInput={currentInput}
                setCurrentInput={setCurrentInput}
                handleSendMessage={handleSendMessage}
              />
            </div>
            <StoryModal
              isOpen={isStoryModalOpen}
              onClose={() => setIsStoryModalOpen(false)}
              content={lessonContent}
            />
          </div>
        );
      case LearningState.ERROR:
        return (
          <div className="flex flex-col items-center justify-center h-screen text-center p-4">
            <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
            <p className="text-gray-300 max-w-md mb-6">{error}</p>
            <button
              onClick={() => setLearningState(LearningState.SETUP)}
              className="text-white font-bold py-2 px-6 rounded-lg transition-all"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Try Again
            </button>
          </div>
        );
    }
  };

  return <>{renderContent()}</>;
}
