'use client';

import React from 'react';
import { useVibePlayer, VIBE_MOODS } from './VibePlayerContext';
import { cn } from '@/lib/utils';

export default function VibeMoodBar() {
  const { activeMood, setActiveMood } = useVibePlayer();

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-1">
      {VIBE_MOODS.map((mood) => {
        const isActive = activeMood === mood.id;
        return (
          <button
            key={mood.id}
            onClick={() => setActiveMood(mood.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 border-2",
              isActive 
                ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"
            )}
          >
            <span>{mood.emoji}</span>
            <span>{mood.label}</span>
          </button>
        );
      })}
    </div>
  );
}
