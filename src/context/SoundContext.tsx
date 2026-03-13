'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SoundContextType {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (val: boolean) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(true);

  // Sync with localStorage so the user's preference persists across sessions
  useEffect(() => {
    const saved = localStorage.getItem('gamhub_sound_pref');
    if (saved !== null) {
      setIsMuted(saved === 'muted');
    }
  }, []);

  const handleToggle = () => {
    setIsMuted(prev => {
      const newVal = !prev;
      localStorage.setItem('gamhub_sound_pref', newVal ? 'muted' : 'unmuted');
      return newVal;
    });
  };

  const handleSetMuted = (val: boolean) => {
    setIsMuted(val);
    localStorage.setItem('gamhub_sound_pref', val ? 'muted' : 'unmuted');
  };

  return (
    <SoundContext.Provider value={{ isMuted, toggleMute: handleToggle, setMuted: handleSetMuted }}>
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
