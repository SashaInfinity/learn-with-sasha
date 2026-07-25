import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 animate-fadeInUp"
            style={{ animationDuration: '0.3s' }}
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl border animate-pulseGlowThemed"
                style={{ borderColor: 'var(--color-border-themed)' }}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--color-border-surface)' }}>
                    {title && <h2 className="text-xl font-bold text-white">{title}</h2>}
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors ml-auto"
                        aria-label="Close modal"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;