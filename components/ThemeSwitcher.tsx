import React from 'react';
import { Theme } from '../types';

interface ThemeSwitcherProps {
    currentTheme: Theme;
    onThemeChange: (theme: Theme) => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentTheme, onThemeChange }) => {
    // This component is disabled as the application now has a single, static theme.
    return null;
};

export default ThemeSwitcher;
