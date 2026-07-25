import React from 'react';
import { Message, Role } from '../types';
import { SparklesIcon, MagicWandIcon } from './IconComponents';
import { Markdown } from '../lib/markdown';

interface ChatMessageProps {
    message: Message;
    onSimplify: (text: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSimplify }) => {
    const isUser = message.role === Role.USER;

    return (
        <div className={`flex items-start gap-4 my-4 animate-fadeInUp ${isUser ? 'justify-end' : ''}`}>
            {!isUser && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center" style={{'--tw-gradient-from': 'var(--color-primary)', '--tw-gradient-to': 'var(--color-primary-darker, var(--color-primary))'} as React.CSSProperties}>
                   <SparklesIcon className="w-6 h-6 text-white"/>
                </div>
            )}
            <div className={`max-w-xl p-4 rounded-2xl shadow-md ${isUser ? 'text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`} style={{ backgroundColor: isUser ? 'var(--color-user-message-bg)' : 'var(--color-surface-2, #374151)'}}>
                {isUser ? (
                     <p className="whitespace-pre-wrap">{message.text}</p>
                ) : (
                    <Markdown content={message.text} />
                )}
                {message.image && (
                     <div className="mt-4">
                        <img src={message.image} alt="Generated illustration" className="rounded-lg shadow-lg max-w-full h-auto" />
                     </div>
                )}
                {!isUser && message.text && (
                    <div className="mt-3 pt-2 border-t border-gray-600">
                        <button 
                            onClick={() => onSimplify(message.text)} 
                            className="text-xs font-semibold flex items-center gap-1 transition-colors"
                            style={{color: 'var(--color-text-accent)'}}
                        >
                            <MagicWandIcon className="w-4 h-4" />
                            Simplify
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;