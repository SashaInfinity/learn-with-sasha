import React, { useState, useEffect } from 'react';

const loadingMessages = [
    "Crafting your personalized lesson...",
    "Connecting concepts to your interests...",
    "Warming up the neural network...",
    "Generating creative illustrations...",
    "Almost there..."
];

const LoadingSpinner: React.FC = () => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setMessageIndex(prevIndex => (prevIndex + 1) % loadingMessages.length);
        }, 2500); // Change message every 2.5 seconds

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div
            className="flex flex-col items-center justify-center h-screen text-center p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="grid-loader mb-8" aria-hidden="true">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            <span className="sr-only">Loading</span>
            <p className="text-2xl font-bold tracking-wider text-gray-300 animate-fadeInUp h-8" style={{ animationDelay: '0.5s' }}>
                {loadingMessages[messageIndex]}
            </p>
        </div>
    );
};

export default LoadingSpinner;