'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SoundContextType {
  soundOn: boolean;
  toggleSound: () => void;
  setSoundOn: (val: boolean) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  // Default to false (muted) to comply with browser autoplay policies
  const [soundOn, setSoundOnState] = useState(false);

  // Sync with localStorage so the user's preference persists across sessions
  useEffect(() => {
    const saved = localStorage.getItem('gamhub_sound_pref');
    if (saved !== null) {
      setSoundOnState(saved === 'on');
    }
  }, []);

  const toggleSound = () => {
    setSoundOnState(prev => {
      const newVal = !prev;
      localStorage.setItem('gamhub_sound_pref', newVal ? 'on' : 'off');
      return newVal;
    });
  };

  const setSoundOn = (val: boolean) => {
    setSoundOnState(val);
    localStorage.setItem('gamhub_sound_pref', val ? 'on' : 'off');
  };

  return (
    <SoundContext.Provider value={{ soundOn, toggleSound, setSoundOn }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
