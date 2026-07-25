import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Chat, Modality, LiveServerMessage, type Blob } from '@google/genai';
import { Message, Role, LearningState, FileData, QuizQuestion, LessonContent } from './types';
import { BookOpenIcon } from './components/IconComponents';
import LoadingSpinner from './components/LoadingSpinner';
import AnimatedBackground from './components/AnimatedBackground';
import AnimatedTitle from './components/AnimatedTitle';
import LandingPage from './components/LandingPage';
import MultiStepSetup from './components/MultiStepSetup';
import LearningDashboard from './components/LearningDashboard';
import ChatPanel from './components/ChatPanel';
import StoryModal from './components/StoryModal';

// Helper functions for audio processing (must be defined at top-level)
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// FIX: Added createBlob helper function for efficient audio processing, as recommended by guidelines.
function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

const parseLesson = (text: string): LessonContent => {
    const sections: LessonContent = {
        overview: '',
        explanation: '',
        visualIdea: '',
        keyPoints: [],
    };

    // Helper to extract content between two headers. It's more robust than a single split.
    const getContentBetween = (startHeader: string, endHeader?: string): string => {
        // Find the start header, being flexible with markdown and case.
        const startRegex = new RegExp(`(?:\\*\\*|###|##|\\*|-|\\s)*${startHeader}(?:\\*\\*|:)?`, 'i');
        const startMatch = text.match(startRegex);
        
        // If the start header isn't found, there's no content for this section.
        if (!startMatch || typeof startMatch.index === 'undefined') {
            return '';
        }

        // The content begins right after the matched header text.
        const contentStart = startMatch.index + startMatch[0].length;
        let contentEnd = text.length; // By default, content goes to the end of the text.

        // If an end header is provided, find its position to mark the end of the content.
        if (endHeader) {
            const endRegex = new RegExp(`(?:\\*\\*|###|##|\\*|-|\\s)*${endHeader}(?:\\*\\*|:)?`, 'i');
            // We search for the end header *after* the start header.
            const endMatch = text.substring(contentStart).match(endRegex);
            if (endMatch && typeof endMatch.index !== 'undefined') {
                contentEnd = contentStart + endMatch.index;
            }
        }
        
        return text.substring(contentStart, contentEnd).trim();
    };

    sections.overview = getContentBetween('Concept Overview', 'Interest-Based Explanation');
    sections.explanation = getContentBetween('Interest-Based Explanation', 'Illustration / Visual Idea');
    sections.visualIdea = getContentBetween('Illustration / Visual Idea', 'Key Points & Quiz');
    const keyPointsAndQuizContent = getContentBetween('Key Points & Quiz');
    
    if (keyPointsAndQuizContent) {
        const quizIndex = keyPointsAndQuizContent.toLowerCase().indexOf('quiz:');
        const pointsSection = quizIndex > -1 ? keyPointsAndQuizContent.substring(0, quizIndex) : keyPointsAndQuizContent;
        const keyPointsContent = pointsSection.replace(/key points:/i, '').trim();

        sections.keyPoints = keyPointsContent.split('\n')
            .map(p => p.replace(/^[\s•*-]+/, '').trim()) // Remove leading bullets/whitespace
            .filter(Boolean); // Remove any empty lines
    }
    
    // Check if any content was parsed. If not, fallback to displaying the raw text.
    const hasContent = sections.overview || sections.explanation || sections.visualIdea || sections.keyPoints.length > 0;

    if (!hasContent) {
        console.error("Could not find any lesson headers in the text. Displaying raw text in overview.");
        sections.overview = text;
    }

    return sections;
};

export default function App() {
    const [showLanding, setShowLanding] = useState(true);
    const [learningState, setLearningState] = useState<LearningState>(LearningState.SETUP);
    const [userName, setUserName] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isSashaThinking, setIsSashaThinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quizData, setQuizData] = useState<QuizQuestion[] | null>(null);
    const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
    const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);

    const [isRecording, setIsRecording] = useState(false);
    const [liveUserInput, setLiveUserInput] = useState('');
    // FIX: Changed LiveSession to any as it is not an exported type.
    const sessionPromise = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    // FIX: Added a ref to manage audio sources for proper handling of interruptions and cleanup.
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const chatRef = useRef<Chat | null>(null);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages, liveUserInput, isSashaThinking]);

    const handleStartLearning = async (name: string, interests: string, topic: string, uploadedFile: FileData | null, lang: string) => {
        setLearningState(LearningState.LOADING);
        setError(null);
        setQuizData(null);
        setLessonContent(null);
        setUserName(name);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const systemInstruction = `You are Sasha, an expert and friendly AI math tutor. You are creating a personalized lesson for a student named ${name}.

Instructions:
1. Analyze the student's interests (${interests}) and connect them meaningfully to the chosen math concept (${topic}).
2. Explain the concept step-by-step in concise, simple, and engaging language, as if you are talking directly to ${name}. Keep explanations brief and to the point, using analogies where helpful but avoiding lengthy paragraphs.
3. Generate supportive content including:
   - A clear, short textual explanation of the concept.
   - A brief real-world example or analogy tied to the student's interests.
   - A short description of an AI-generated illustration or diagram idea.
4. Summarize the key takeaways and provide a short, 2-question multiple-choice quiz in a JSON block. The JSON should be an array of objects, where each object has "question", "options" (an array of strings), and "answer" (the index of the correct option).

Output format:
- **Concept Overview:**
- **Interest-Based Explanation:**
- **Illustration / Visual Idea:**
- **Key Points & Quiz:**
  - Key Points: [List of points]
  - Quiz:
    \`\`\`json
    [
      {
        "question": "...",
        "options": ["...", "...", "..."],
        "answer": 1
      },
      {
        "question": "...",
        "options": ["...", "...", "..."],
        "answer": 0
      }
    ]
    \`\`\``;

            const userPrompt = `Student's name: ${name}
Student's interest: ${interests}
Concept to learn: ${topic}
Uploaded notes (if any): ${uploadedFile ? `User has uploaded an image named ${uploadedFile.name}.` : "None"}
Target Language: ${lang}`;
            
            // const imagePrompt = `Create a simple, clear, and visually appealing educational illustration for the concept of "${topic}", inspired by "${interests}". For example, if the topic is probability and the interest is basketball, create an image of a basketball court showing different shot probabilities. The style should be clean, modern, and slightly futuristic.`;
            
            const [lessonResponse] = await Promise.all([
                 ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ text: userPrompt }] },
                    config: { systemInstruction: systemInstruction },
                 }),
                //  ai.models.generateContent({
                //     model: 'gemini-2.5-flash-image',
                //     contents: { parts: [{ text: imagePrompt }] },
                //     config: { responseModalities: [Modality.IMAGE] },
                //  }),
            ]);

            const responseText = lessonResponse.text ?? '';

            const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
            const jsonMatch = responseText.match(jsonRegex);
            const textWithoutJson = responseText.replace(jsonRegex, '').trim();

            if (jsonMatch && jsonMatch[1]) {
                try {
                    const parsedQuiz: QuizQuestion[] = JSON.parse(jsonMatch[1]);
                    setQuizData(parsedQuiz);
                } catch (e) {
                    console.error("Failed to parse quiz JSON:", e);
                    setError("The AI generated an invalid quiz format. Please try again.");
                }
            } else {
                 setError("The AI did not generate a quiz for this topic.");
            }
            
            const parsedLesson = parseLesson(textWithoutJson);
            setLessonContent(parsedLesson);
            
            //  for (const part of imageResponse.candidates?.[0]?.content?.parts ?? []) {
            //     if (part.inlineData) {
            //        setLessonImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            //     }
            // }

            chatRef.current = ai.chats.create({
              model: 'gemini-2.5-flash',
              config: {
                systemInstruction: `You are Sasha, a helpful and encouraging math tutor continuing the conversation with ${name}. They have just learned about ${topic} in the context of ${interests}. Address them by their name occasionally to make the conversation personal. Keep your answers concise and clear.`
              }
            });
            
            setLearningState(LearningState.LEARNING);

        } catch (e: any) {
            console.error(e);
            setError(`An error occurred: ${e.message || 'Please try again.'}`);
            setLearningState(LearningState.ERROR);
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || !chatRef.current || isSashaThinking) return;
        
        const userMessage: Message = { role: Role.USER, text };
        setMessages(prev => [...prev, userMessage]);
        setCurrentInput('');
        setIsSashaThinking(true);

        try {
            const response = await chatRef.current.sendMessage({ message: text });
            const modelMessage: Message = { role: Role.MODEL, text: response.text ?? '' };
            setMessages(prev => [...prev, modelMessage]);

        } catch (e: any) {
            console.error(e);
            const errorMessage: Message = { role: Role.MODEL, text: `Sorry, I encountered an error. ${e.message}` };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsSashaThinking(false);
        }
    };

     const handleSimplify = async (textToSimplify: string) => {
        if (isSashaThinking) return;

        const simplifyMessage: Message = { role: Role.USER, text: `Please simplify this for me: "${textToSimplify}"` };
        setMessages(prev => [...prev, simplifyMessage]);
        setIsSashaThinking(true);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Explain the following text in very simple terms, as if you were talking to a 10-year-old. Text: "${textToSimplify}"`,
            });

            const modelMessage: Message = { role: Role.MODEL, text: response.text ?? '' };
            setMessages(prev => [...prev, modelMessage]);

        } catch (e: any) {
            console.error("Simplification error:", e);
            const errorMessage: Message = { role: Role.MODEL, text: `Sorry, I couldn't simplify that right now. ${e.message}` };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsSashaThinking(false);
        }
    };

    const handleVoiceInteraction = useCallback(async () => {
        if (isRecording) {
            // Stop recording logic
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }
             if (scriptProcessorRef.current) {
                scriptProcessorRef.current.disconnect();
                scriptProcessorRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                await audioContextRef.current.close();
            }
            if (sessionPromise.current) {
                const session = await sessionPromise.current;
                session.close();
                sessionPromise.current = null;
            }
            // FIX: Stop all currently playing audio sources when recording stops.
             audioSourcesRef.current.forEach(source => source.stop());
             audioSourcesRef.current.clear();
            if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
                await outputAudioContextRef.current.close();
            }

            setIsRecording(false);
            if (liveUserInput.trim()) {
                handleSendMessage(liveUserInput);
            }
            setLiveUserInput('');

        } else {
            // Start recording logic
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaStreamRef.current = stream;
                setIsRecording(true);

                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                let nextStartTime = 0;

                sessionPromise.current = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: () => {
                            const source = audioContextRef.current!.createMediaStreamSource(stream);
                            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                            scriptProcessorRef.current = processor;
                            
                            processor.onaudioprocess = (audioProcessingEvent) => {
                                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                const pcmBlob = createBlob(inputData);
                                
                                if (sessionPromise.current) {
                                    sessionPromise.current.then((session) => {
                                        session.sendRealtimeInput({ media: pcmBlob });
                                    });
                                }
                            };
                            source.connect(processor);
                            processor.connect(audioContextRef.current!.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                           if (message.serverContent?.inputTranscription) {
                                setLiveUserInput(prev => prev + message.serverContent!.inputTranscription!.text);
                            }
                            if (message.serverContent?.turnComplete) {
                                const fullInput = liveUserInput + (message.serverContent?.inputTranscription?.text || '');
                                if(fullInput.trim()) {
                                    setMessages(prev => [...prev, {role: Role.USER, text: fullInput.trim()}]);
                                }
                                setLiveUserInput('');
                            }
                           
                            const firstPart = message.serverContent?.modelTurn?.parts?.[0];
                            const base64Audio = firstPart?.inlineData?.data;
                            if (base64Audio && outputAudioContextRef.current) {
                                if (message.serverContent?.inputTranscription) { // AI is responding, clear the live input
                                    setLiveUserInput('');
                                }
                                const partText = firstPart?.text;
                                if (partText) {
                                     setMessages(prev => [...prev, {role: Role.MODEL, text: partText}]);
                                }

                                const outputCtx = outputAudioContextRef.current;
                                nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputCtx.destination);
                                source.start(nextStartTime);
                                nextStartTime += audioBuffer.duration;
                                
                                audioSourcesRef.current.add(source);
                                source.onended = () => {
                                    audioSourcesRef.current.delete(source);
                                };
                            }
                            
                            if (message.serverContent?.interrupted) {
                                audioSourcesRef.current.forEach(source => source.stop());
                                audioSourcesRef.current.clear();
                                nextStartTime = 0;
                            }
                        },
                        onerror: (e: ErrorEvent) => {
                            console.error('Live session error:', e);
                            setError(`Voice session error: ${e.message}. Please try again.`);
                            setIsRecording(false);
                        },
                        onclose: () => {
                            console.log('Live session closed.');
                        },
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        inputAudioTranscription: {},
                        systemInstruction: 'You are a helpful and encouraging math tutor. Keep your answers concise and clear.'
                    },
                });

            } catch (err: any) {
                console.error('Error starting voice interaction:', err);
                setError(`Could not start microphone: ${err.message}`);
                setIsRecording(false);
            }
        }
    }, [isRecording, liveUserInput]);

    const handleStoryOverview = () => {
        setIsStoryModalOpen(true);
    };

    const renderContent = () => {
        if (showLanding) {
            return <LandingPage onGetStarted={() => setShowLanding(false)} />;
        }

        switch (learningState) {
            case LearningState.SETUP:
                return <MultiStepSetup onStart={handleStartLearning} />;
            case LearningState.LOADING:
                return <LoadingSpinner />;
            case LearningState.LEARNING:
                 return (
                    <div className="flex flex-col lg:flex-row gap-8 max-w-screen-2xl mx-auto px-4 py-8 animate-fadeInUp">
                        {/* Left Main Content */}
                        <div className="lg:w-2/3">
                            <header className="flex justify-between items-center mb-6">
                               <div className="flex items-center gap-4">
                                    <BookOpenIcon className="w-10 h-10 animate-float" style={{'--tw-shadow': '0 0 20px var(--color-primary-glow)', '--tw-shadow-color': 'var(--color-primary-glow)', color: 'var(--color-accent)', filter: 'drop-shadow(var(--tw-shadow))'} as React.CSSProperties} />
                                    <AnimatedTitle text={`Here's Your Lesson, ${userName}`} className="text-3xl" />
                               </div>
                            </header>
                            
                            {lessonContent && <LearningDashboard content={lessonContent} quizData={quizData} onStoryOverview={handleStoryOverview} />}
                        </div>

                        {/* Right Chat Panel */}
                        <div className="lg:w-1/3 lg:sticky lg:top-8 h-[70vh] lg:h-[calc(100vh-4rem)]">
                            <ChatPanel
                                 messages={messages}
                                 onSimplify={handleSimplify}
                                 isSashaThinking={isSashaThinking}
                                 liveUserInput={liveUserInput}
                                 endOfMessagesRef={endOfMessagesRef}
                                 isRecording={isRecording}
                                 handleVoiceInteraction={handleVoiceInteraction}
                                 currentInput={currentInput}
                                 setCurrentInput={setCurrentInput}
                                 handleSendMessage={handleSendMessage}
                             />
                        </div>

                        <StoryModal isOpen={isStoryModalOpen} onClose={() => setIsStoryModalOpen(false)} content={lessonContent} />

                        {/* <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="AI Generated Illustration">
                            {lessonImage && <img src={lessonImage} alt={lessonContent?.visualIdea} className="rounded-lg w-full h-auto object-contain max-h-[70vh]" />}
                        </Modal> */}
                    </div>
                );
            case LearningState.ERROR:
                return (
                    <div className="flex flex-col items-center justify-center h-screen text-center p-4">
                        <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
                        <p className="text-gray-300 max-w-md mb-6">{error}</p>
                        <button onClick={() => setLearningState(LearningState.SETUP)} className="text-white font-bold py-2 px-6 rounded-lg transition-all" style={{backgroundColor: 'var(--color-primary)'}}>
                            Try Again
                        </button>
                    </div>
                );
        }
    };

    return (
        <main>
            <AnimatedBackground />
            {renderContent()}
        </main>
    );
}