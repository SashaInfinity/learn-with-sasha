import React from 'react';

interface AnimatedTitleProps {
  text: string;
  className?: string;
}

const AnimatedTitle: React.FC<AnimatedTitleProps> = ({ text, className = '' }) => {
  return (
    <h1 className={`text-4xl font-bold tracking-wider themed-title ${className}`}>
      {text}
    </h1>
  );
};

export default AnimatedTitle;
