import React, { useState, useRef, useEffect } from 'react';
import { FileData, Preferences } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { UploadIcon, SparklesIcon } from './IconComponents';
import AnimatedTitle from './AnimatedTitle';

interface MultiStepSetupProps {
    onStart: (name: string, interests: string, topic: string, file: FileData | null, lang: string) => void;
    initialName?: string;
}

const ProgressBar: React.FC<{ step: number; totalSteps: number }> = ({ step, totalSteps }) => {
    return (
        <div className="flex justify-center space-x-4 mb-8">
            {Array.from({ length: totalSteps }, (_, i) => (
                <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${i < step ? 'bg-orange-500 scale-110' : 'bg-gray-600'}`}
                    style={{backgroundColor: i < step ? 'var(--color-primary)' : 'var(--color-user-message-bg)'}}
                />
            ))}
        </div>
    );
};

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
    // Chain caller-supplied onFocus/onBlur with our visual styling so neither
    // silently drops the other (previously the caller's handlers were ignored).
    const { onFocus, onBlur, ...rest } = props;
    return (
        <input
            {...rest}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg transition-all duration-300 focus:scale-[1.03] focus:outline-none"
            style={{ '--tw-shadow': '0 0 20px var(--color-primary-glow)', '--tw-shadow-color': 'var(--color-primary-glow)', borderColor: 'var(--color-gray-600)' } as React.CSSProperties}
            onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-accent)';
                e.target.style.boxShadow = 'var(--tw-shadow)';
                onFocus?.(e);
            }}
            onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-gray-600)';
                e.target.style.boxShadow = 'none';
                onBlur?.(e);
            }}
        />
    );
};

const MultiStepSetup: React.FC<MultiStepSetupProps> = ({ onStart, initialName }) => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [name, setName] = useState(initialName ?? user?.display_name ?? '');
    const [topic, setTopic] = useState('');
    const [interests, setInterests] = useState('');
    const [language, setLanguage] = useState('English');
    const [file, setFile] = useState<FileData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Pre-fill interests/language from saved preferences (returning students).
    useEffect(() => {
        let cancelled = false;
        api.getPreferences()
            .then(({ preferences }: { preferences: Preferences | null }) => {
                if (cancelled || !preferences) return;
                // Only pre-fill interests if the user hasn't typed anything yet.
                setInterests((prev) =>
                    prev
                        ? prev
                        : Array.isArray(preferences.interests) && preferences.interests.length
                          ? preferences.interests.join(', ')
                          : '',
                );
                if (preferences.language) setLanguage(preferences.language);
            })
            .catch(() => {
                /* not logged in or no prefs yet — fine */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64 = (e.target?.result as string).split(',')[1];
                    setFile({ name: selectedFile.name, type: selectedFile.type, base64 });
                };
                reader.readAsDataURL(selectedFile);
            } else {
                alert('Please upload an image file (e.g., PNG, JPEG).');
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    };

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        if ((step === 1 && name) || (step === 2 && topic)) {
            setStep(s => s + 1);
        }
    };

    const handleBack = () => {
        setStep(s => s - 1);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (interests.trim()) {
            onStart(name, interests, topic, file, language);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <form onSubmit={handleNext} className="w-full animate-fadeInUp">
                        <label htmlFor="name" className="block text-xl font-medium text-gray-300 mb-4 text-center">First, what should I call you?</label>
                        <FormInput
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Alex"
                            required
                            autoFocus
                        />
                         <div className="mt-8 flex justify-end">
                            <button type="submit" className="text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-100" style={{backgroundColor: 'var(--color-primary)'}}>Next</button>
                        </div>
                    </form>
                );
            case 2:
                return (
                    <form onSubmit={handleNext} className="w-full animate-fadeInUp">
                        <label htmlFor="topic" className="block text-xl font-medium text-gray-300 mb-4 text-center">Great! What math topic would you like to learn today, {name}?</label>
                        <FormInput
                            type="text"
                            id="topic"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., Algebra, Probability, Calculus"
                            required
                             autoFocus
                        />
                        <div className="mt-8 flex justify-between">
                            <button type="button" onClick={handleBack} className="text-gray-300 font-bold py-3 px-8 rounded-lg transition-colors hover:bg-gray-700">Back</button>
                            <button type="submit" className="text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-100" style={{backgroundColor: 'var(--color-primary)'}}>Next</button>
                        </div>
                    </form>
                );
            case 3:
                return (
                    <form onSubmit={handleSubmit} className="w-full animate-fadeInUp space-y-6">
                        <div>
                            <label htmlFor="interests" className="block text-xl font-medium text-gray-300 mb-4 text-center">Awesome! Now, tell me about your interests.</label>
                            <FormInput
                                type="text"
                                id="interests"
                                value={interests}
                                onChange={(e) => setInterests(e.target.value)}
                                placeholder="e.g., Music, Sports, Gaming"
                                required
                                 autoFocus
                            />
                        </div>
                         <div>
                            <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                            <select
                                id="language"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white transition-all duration-300 focus:scale-[1.03] focus:outline-none appearance-none"
                                style={{'--tw-shadow': '0 0 20px var(--color-primary-glow)', '--tw-shadow-color': 'var(--color-primary-glow)', borderColor: 'var(--color-gray-600)'} as React.CSSProperties}
                                onFocus={(e) => { e.target.style.borderColor = 'var(--color-accent)'; e.target.style.boxShadow = 'var(--tw-shadow)'; }}
                                onBlur={(e) => { e.target.style.borderColor = 'var(--color-gray-600)'; e.target.style.boxShadow = 'none'; }}
                            >
                                <option>English</option>
                                <option>Tamil</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Upload Study Material (Optional Image)</label>
                            <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                                <div className="space-y-1 text-center">
                                    <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
                                    <div className="flex text-sm text-gray-400">
                                        <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-700 rounded-md font-medium hover:text-violet-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-violet-500 px-1" style={{color: 'var(--color-accent)'}}>
                                            <span>Upload a file</span>
                                            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} ref={fileInputRef} accept="image/*" />
                                        </label>
                                        <p className="pl-1">or drag and drop</p>
                                    </div>
                                    <p className="text-xs text-gray-500">{file ? file.name : 'PNG, JPG, GIF up to 10MB'}</p>
                                </div>
                            </div>
                        </div>
                         <div className="mt-8 flex justify-between">
                            <button type="button" onClick={handleBack} className="text-gray-300 font-bold py-3 px-8 rounded-lg transition-colors hover:bg-gray-700">Back</button>
                            <button type="submit" className="text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 active:scale-100" style={{backgroundColor: 'var(--color-primary)'}}>
                                <SparklesIcon className="w-5 h-5" />
                                Generate Lesson
                            </button>
                        </div>
                    </form>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gray-900/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border animate-pulseGlowThemed" style={{ borderColor: 'var(--color-border-themed)' }}>
                <div className="text-center mb-8">
                    <AnimatedTitle text="Learn With Sasha" />
                </div>
                <ProgressBar step={step} totalSteps={3} />
                <div className="min-h-[280px] flex items-center">
                    {renderStep()}
                </div>
            </div>
        </div>
    );
};

export default MultiStepSetup;