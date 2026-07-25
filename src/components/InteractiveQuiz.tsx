import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface InteractiveQuizProps {
    questions: QuizQuestion[];
}

const InteractiveQuiz: React.FC<InteractiveQuizProps> = ({ questions }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    const currentQuestion = questions[currentQuestionIndex];

    const handleAnswerSelect = (optionIndex: number) => {
        if (showFeedback) return;
        setSelectedAnswer(optionIndex);
    };

    const handleSubmit = () => {
        if (selectedAnswer === null) return;

        setShowFeedback(true);
        if (selectedAnswer === currentQuestion.answer) {
            setScore(prev => prev + 1);
        }
    };

    const handleNextQuestion = () => {
        setShowFeedback(false);
        setSelectedAnswer(null);
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setQuizFinished(true);
        }
    };
    
    const handleRestart = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setScore(0);
        setQuizFinished(false);
    }

    if (quizFinished) {
        return (
            <div className="my-6 p-6 bg-gray-900/50 backdrop-blur-sm rounded-2xl border shadow-lg" style={{borderColor: 'var(--color-border-surface)'}}>
                <h3 className="text-2xl font-bold text-white mb-4">Quiz Complete!</h3>
                <p className="text-lg text-gray-300">
                    Your final score is: <span className="font-bold" style={{color: 'var(--color-accent)'}}>{score}</span> out of <span className="font-bold" style={{color: 'var(--color-accent)'}}>{questions.length}</span>
                </p>
                 <button 
                    onClick={handleRestart}
                    className="mt-6 text-white font-bold py-2 px-4 rounded-lg transition-all hover:scale-105 active:scale-100"
                    style={{backgroundColor: 'var(--color-primary)'}}
                >
                    Retake Quiz
                </button>
            </div>
        )
    }

    return (
        <div className="my-6 p-6 bg-gray-900/50 backdrop-blur-sm rounded-2xl border shadow-lg" style={{borderColor: 'var(--color-border-surface)'}}>
            <h3 className="text-xl font-bold text-white mb-1">Check your understanding</h3>
            <p className="text-sm text-gray-400 mb-4">Question {currentQuestionIndex + 1} of {questions.length}</p>
            <p className="text-lg text-gray-200 mb-6">{currentQuestion.question}</p>
            
            <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                    const style: React.CSSProperties = {
                        transition: 'all 0.2s ease-in-out',
                    };
                    
                    if (showFeedback) {
                        style.transform = 'scale(1.01)';
                        if (index === currentQuestion.answer) {
                            style.backgroundColor = `rgba(var(--color-success-rgb), 0.3)`;
                            style.borderColor = `var(--color-success)`;
                            style.boxShadow = `0 0 15px rgba(var(--color-success-rgb), 0.5)`;
                        } else if (index === selectedAnswer) {
                            style.backgroundColor = `rgba(var(--color-danger-rgb), 0.3)`;
                            style.borderColor = `var(--color-danger)`;
                            style.boxShadow = `0 0 15px rgba(var(--color-danger-rgb), 0.5)`;
                        } else {
                            style.opacity = '0.6';
                        }
                    } else {
                        if (index === selectedAnswer) {
                             style.backgroundColor = `rgba(var(--color-primary-rgb, 139, 92, 246), 0.5)`;
                             style.borderColor = `var(--color-primary)`;
                             style.transform = `scale(1.03)`;
                             style.boxShadow = `0 0 15px var(--color-primary-glow)`;
                        }
                    }
                    
                    return (
                        <button key={index} onClick={() => handleAnswerSelect(index)} className="w-full text-left p-4 rounded-lg border-2 transform hover:scale-[1.03] bg-gray-700 border-gray-600 text-gray-300" style={style} disabled={showFeedback}>
                            {option}
                        </button>
                    )
                })}
            </div>

            <div className="mt-6 text-right">
                {showFeedback ? (
                     <button onClick={handleNextQuestion} className="text-white font-bold py-2 px-6 rounded-lg transition-all hover:scale-105 active:scale-100" style={{backgroundColor: 'var(--color-primary)'}}>
                        {currentQuestionIndex < questions.length - 1 ? 'Next' : 'Finish'}
                    </button>
                ) : (
                    <button onClick={handleSubmit} disabled={selectedAnswer === null} className="text-white font-bold py-2 px-6 rounded-lg transition-all hover:scale-105 active:scale-100 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:scale-100" style={{backgroundColor: 'var(--color-primary)'}}>
                        Submit
                    </button>
                )}
            </div>
        </div>
    );
};

export default InteractiveQuiz;