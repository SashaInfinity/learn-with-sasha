import React from 'react';
import { LessonContent, QuizQuestion } from '../types';
import { MagicWandIcon } from './IconComponents';
import InteractiveQuiz from './InteractiveQuiz';
import { Markdown } from '../lib/markdown';

interface DashboardCardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, children, className = '', style }) => {
    return (
        <div 
            className={`bg-gray-800/80 backdrop-blur-sm rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${className}`} 
            style={{borderColor: 'var(--color-border-themed)', boxShadow: '0 0 20px var(--color-primary-glow)', ...style}}
        >
            <h3 className="text-xl font-bold text-white mb-3 tracking-wider">{title}</h3>
            <div className="text-gray-200 leading-relaxed overflow-y-auto flex-grow">
                {children}
            </div>
        </div>
    );
};

interface LearningDashboardProps {
    content: LessonContent;
    quizData: QuizQuestion[] | null;
    onStoryOverview: () => void;
}

const LearningDashboard: React.FC<LearningDashboardProps> = ({ content, quizData, onStoryOverview }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardCard title="Concept Overview" className="animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
                <Markdown content={content.overview} className="space-y-2" />
            </DashboardCard>
            <DashboardCard title="Personalized Explanation" className="animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                <Markdown content={content.explanation} className="space-y-2" />
            </DashboardCard>
            <DashboardCard title="Key Points" className="animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
                 <ul className="space-y-2">
                    {content.keyPoints.map((point, index) =>
                        <li key={`${index}-${point.slice(0, 20)}`} className="flex items-start">
                            <span className="text-orange-400 mr-3 mt-1" aria-hidden="true">&#10148;</span>
                            <span>{point}</span>
                        </li>
                    )}
                </ul>
            </DashboardCard>
            {quizData && (
                <DashboardCard title="Test Your Knowledge" className="animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                    <InteractiveQuiz questions={quizData} />
                </DashboardCard>
            )}
            <div className="lg:col-span-2 flex justify-center mt-4">
                <button 
                    onClick={onStoryOverview}
                    className="text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-100 text-lg animate-pulseGlowThemed mx-auto"
                    style={{backgroundColor: 'var(--color-primary)'}}
                >
                    <MagicWandIcon className="w-6 h-6" />
                    Story Overview
                </button>
            </div>
        </div>
    );
};

export default LearningDashboard;