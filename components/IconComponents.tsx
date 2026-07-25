import React from 'react';

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const UploadIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const MicIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5a6 6 0 0 0-12 0v1.5a6 6 0 0 0 6 6Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v.75a7.5 7.5 0 0 1-7.5 7.5h-.008a7.5 7.5 0 0 1-7.492-7.5v-.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 .75.75Z" />
  </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const StopIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.254 9.254 9 9.563 9h4.874c.309 0 .563.254.563.563v4.874c0 .309-.254.563-.563.563H9.563C9.254 15 9 14.746 9 14.437V9.563Z" />
    </svg>
);

export const PlayIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
    </svg>
);

export const PauseIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0v-6" />
    </svg>
);


// FIX: Update component props to accept standard SVG attributes like 'style'.
export const SendIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const SparklesIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const BookOpenIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6-2.292m0 0v14.25" />
    </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const MagicWandIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.475 2.118 2.25 2.25 0 0 1-2.475-2.118c0-.493.212-.962.55-1.29a3 3 0 0 0 4.242-4.242 3 3 0 0 0-4.242-4.242 3 3 0 0 0-1.29.55 2.25 2.25 0 0 1-2.118-2.475 2.25 2.25 0 0 1 2.118-2.475c.493 0 .962.212 1.29.55a3 3 0 0 0 4.242 4.242 3 3 0 0 0 4.242 4.242 3 3 0 0 0 1.29-.55 2.25 2.25 0 0 1 2.118 2.475 2.25 2.25 0 0 1-2.118 2.475c-.493 0-.962-.212-1.29-.55a3 3 0 0 0-4.242-4.242Z" />
    </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const ChevronLeftIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const ChevronRightIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const SpeakerWaveIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);

// FIX: Update component props to accept standard SVG attributes like 'style'.
export const SpeakerXMarkIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);