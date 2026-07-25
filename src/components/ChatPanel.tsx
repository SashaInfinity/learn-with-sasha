import React from 'react';
import { Message } from '../types';
import { MicIcon, StopIcon, SendIcon } from './IconComponents';
import ChatMessage from './ChatMessage';
import ThinkingIndicator from './ThinkingIndicator';

interface ChatPanelProps {
    messages: Message[];
    onSimplify: (text: string) => void;
    isSashaThinking: boolean;
    liveUserInput: string;
    endOfMessagesRef: React.RefObject<HTMLDivElement | null>;
    isRecording: boolean;
    handleVoiceInteraction: () => void;
    currentInput: string;
    setCurrentInput: (value: string) => void;
    handleSendMessage: (text: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    messages,
    onSimplify,
    isSashaThinking,
    liveUserInput,
    endOfMessagesRef,
    isRecording,
    handleVoiceInteraction,
    currentInput,
    setCurrentInput,
    handleSendMessage,
}) => {
    return (
        <div className="h-full flex flex-col bg-gray-900/50 backdrop-blur-sm rounded-2xl p-4 border" style={{ borderColor: 'var(--color-border-surface)' }}>
            <h3 className="text-2xl font-bold text-white mb-4 text-center themed-title">Questions for Sasha?</h3>
            <div className="flex-grow overflow-y-auto pr-2 mb-4">
                {messages.map((msg, index) => (
                    <ChatMessage
                        key={`${index}-${msg.role}-${msg.text.slice(0, 12)}`}
                        message={msg}
                        onSimplify={onSimplify}
                    />
                ))}
                {liveUserInput && (
                    <div className="flex items-start gap-4 my-4 justify-end opacity-70">
                        <div className="max-w-xl p-4 rounded-2xl shadow-md text-white rounded-br-none" style={{ backgroundColor: 'var(--color-user-message-bg)' }}>
                            <p className="whitespace-pre-wrap italic">{liveUserInput}</p>
                        </div>
                    </div>
                )}
                {isSashaThinking && <ThinkingIndicator />}
                <div ref={endOfMessagesRef} />
            </div>
            <div className="mt-auto flex items-center gap-2">
                <button onClick={handleVoiceInteraction} className="p-3 rounded-full transition-colors duration-200 flex-shrink-0" style={{ backgroundColor: isRecording ? 'var(--color-danger-hover)' : 'var(--color-primary)' }}>
                    {isRecording ? <StopIcon className={`w-6 h-6 text-white`} /> : <MicIcon className="w-6 h-6 text-white" />}
                </button>
                <div className="relative flex-grow">
                    <input
                        type="text"
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(currentInput)}
                        placeholder="Type your question..."
                        className="w-full bg-gray-700 border border-gray-600 rounded-full pl-5 pr-14 py-3 text-white focus:outline-none"
                        style={{ '--tw-shadow': '0 0 20px var(--color-primary-glow)', '--tw-shadow-color': 'var(--color-primary-glow)', borderColor: 'var(--color-gray-600)' } as React.CSSProperties}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; e.target.style.boxShadow = 'var(--tw-shadow)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--color-gray-600)'; e.target.style.boxShadow = 'none'; }}
                        disabled={isSashaThinking}
                    />
                    <button onClick={() => handleSendMessage(currentInput)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors duration-200 disabled:bg-gray-600" style={{ backgroundColor: 'var(--color-primary)' }} disabled={isSashaThinking}>
                        <SendIcon className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;