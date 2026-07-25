import React from 'react';
import { Message, Role } from '../types';
import { SparklesIcon, MagicWandIcon } from './IconComponents';

// This component parses simple markdown and renders it as HTML.
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const parseMarkdown = (text: string): string => {
        let html = '';
        const lines = text.split('\n');
        let inList = false;

        lines.forEach(line => {
            // Basic security: escape HTML tags.
            let safeLine = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            // **bold** -> <strong>bold</strong>
            safeLine = safeLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // *italic* -> <em>italic</em>
            safeLine = safeLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // Handle unordered lists (*, -, •)
            if (/^\s*[-*•]\s/.test(safeLine)) {
                if (!inList) {
                    html += '<ul class="list-disc list-inside my-2 space-y-1">';
                    inList = true;
                }
                html += `<li>${safeLine.replace(/^\s*[-*•]\s/, '')}</li>`;
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                if (safeLine.trim()) {
                    html += `<p>${safeLine}</p>`;
                }
            }
        });

        if (inList) {
            html += '</ul>';
        }

        return html;
    };

    return <div dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />;
};


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
                    <MarkdownRenderer content={message.text} />
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