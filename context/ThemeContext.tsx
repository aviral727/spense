
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { Appearance } from 'react-native';

type ThemeContextType = {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    autoTheme: boolean;
    setAutoTheme: (enabled: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { colorScheme, toggleColorScheme, setColorScheme } = useColorScheme();
    const [mounted, setMounted] = useState(false);
    const [autoTheme, setAutoThemeState] = useState(false);

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedAutoTheme = await AsyncStorage.getItem('auto-theme');
                const isAutoTheme = savedAutoTheme === 'true';
                setAutoThemeState(isAutoTheme);

                if (isAutoTheme) {
                    const systemTheme = Appearance.getColorScheme();
                    if (systemTheme) {
                        setColorScheme(systemTheme);
                    }
                } else {
                    const savedTheme = await AsyncStorage.getItem('user-theme');
                    if (savedTheme === 'dark' || savedTheme === 'light') {
                        setColorScheme(savedTheme);
                    }
                }
            } catch (error) {
                console.error('Error loading theme:', error);
            } finally {
                setMounted(true);
            }
        };
        loadTheme();
    }, []);

    useEffect(() => {
        if (!autoTheme) return;

        const subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
            if (newColorScheme) {
                setColorScheme(newColorScheme);
            }
        });

        return () => subscription.remove();
    }, [autoTheme]);

    const handleToggle = async () => {
        if (autoTheme) {
            const newTheme = colorScheme === 'dark' ? 'light' : 'dark';
            setColorScheme(newTheme);
            setAutoThemeState(false);
            try {
                await AsyncStorage.setItem('user-theme', newTheme);
                await AsyncStorage.setItem('auto-theme', 'false');
            } catch (error) {
                console.error('Error saving theme:', error);
            }
        } else {
            toggleColorScheme();
            const newTheme = colorScheme === 'dark' ? 'light' : 'dark';
            try {
                await AsyncStorage.setItem('user-theme', newTheme);
            } catch (error) {
                console.error('Error saving theme:', error);
            }
        }
    };

    const handleSetAutoTheme = async (enabled: boolean) => {
        setAutoThemeState(enabled);
        try {
            await AsyncStorage.setItem('auto-theme', enabled.toString());

            if (enabled) {
                const systemTheme = Appearance.getColorScheme();
                if (systemTheme) {
                    setColorScheme(systemTheme);
                }
            }
        } catch (error) {
            console.error('Error saving auto-theme preference:', error);
        }
    };

    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider
            value={{
                theme: colorScheme === 'dark' ? 'dark' : 'light',
                toggleTheme: handleToggle,
                autoTheme,
                setAutoTheme: handleSetAutoTheme
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
