import React from 'react';
import { SparklesIcon } from './IconComponents';

const ThinkingIndicator: React.FC = () => {
    return (
        <div className="flex items-start gap-4 my-4 animate-fadeInUp" role="status" aria-live="polite">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center" style={{'--tw-gradient-from': 'var(--color-primary)', '--tw-gradient-to': 'var(--color-primary-darker, var(--color-primary))'} as React.CSSProperties}>
               <SparklesIcon className="w-6 h-6 text-white" aria-hidden="true"/>
            </div>
            <div className="max-w-xl p-4 rounded-2xl shadow-md bg-gray-700 text-gray-200 rounded-bl-none flex items-center justify-center">
                <span className="sr-only">Sasha is thinking</span>
                <div className="flex items-center space-x-2" aria-hidden="true">
                    <div className="thinking-dot"></div>
                    <div className="thinking-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="thinking-dot" style={{ animationDelay: '0.4s' }}></div>
                </div>
            </div>
        </div>
    );
};

export default ThinkingIndicator;
