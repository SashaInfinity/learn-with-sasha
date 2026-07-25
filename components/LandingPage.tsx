import React from 'react';
import AnimatedTitle from './AnimatedTitle';
import { SparklesIcon } from './IconComponents';

interface LandingPageProps {
    onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-4 text-white">
            <div className="max-w-3xl animate-fadeInUp">
                <AnimatedTitle text="Learn With Sasha" className="text-6xl md:text-7xl lg:text-8xl" />
                <p 
                    className="mt-6 text-xl md:text-2xl text-gray-300"
                    style={{ animation: `fadeInUp 0.6s ease-out 0.3s forwards`, opacity: 0 }}
                >
                    Your Personal AI Tutor for Math.
                </p>
                <p 
                    className="mt-4 max-w-xl mx-auto text-lg text-gray-400"
                    style={{ animation: `fadeInUp 0.6s ease-out 0.6s forwards`, opacity: 0 }}
                >
                    Explore complex math concepts through your favorite topics. Sasha makes learning intuitive, visual, and fun, with lessons tailored just for you.
                </p>
                <div style={{ animation: `fadeInUp 0.6s ease-out 0.9s forwards`, opacity: 0 }}>
                    <button 
                        onClick={onGetStarted}
                        className="mt-10 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-100 text-lg animate-pulseGlowThemed mx-auto"
                        style={{backgroundColor: 'var(--color-primary)'}}
                    >
                        <SparklesIcon className="w-6 h-6" />
                        Get Started
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
