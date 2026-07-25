import React, { useState, useEffect } from 'react';
import { LessonContent } from '../types';
import Modal from './Modal';
import { PlayIcon, PauseIcon, StopIcon } from './IconComponents';

interface StoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: LessonContent | null;
}

const StoryModal: React.FC<StoryModalProps> = ({ isOpen, onClose, content }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speech, setSpeech] = useState<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        if (isOpen && content) {
            const story = `Let me tell you a story about ${content.visualIdea}. ${content.explanation}`;
            const newSpeech = new SpeechSynthesisUtterance(story);
            setSpeech(newSpeech);
        }
    }, [isOpen, content]);

    const handlePlay = () => {
        if (speech) {
            window.speechSynthesis.speak(speech);
            setIsSpeaking(true);
        }
    };

    const handlePause = () => {
        window.speechSynthesis.pause();
        setIsSpeaking(false);
    };

    const handleStop = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Story Overview">
            <div className="flex flex-col items-center justify-center p-6">
                <p className="text-lg text-gray-300 mb-6 text-center">
                    Listen to a story to help you understand the concept.
                </p>
                <div className="flex gap-4">
                    <button onClick={handlePlay} disabled={isSpeaking} className="p-2 rounded-full bg-green-500 text-white disabled:bg-gray-500">
                        <PlayIcon className="w-8 h-8" />
                    </button>
                    <button onClick={handlePause} disabled={!isSpeaking} className="p-2 rounded-full bg-yellow-500 text-white disabled:bg-gray-500">
                        <PauseIcon className="w-8 h-8" />
                    </button>
                    <button onClick={handleStop} className="p-2 rounded-full bg-red-500 text-white">
                        <StopIcon className="w-8 h-8" />
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default StoryModal;