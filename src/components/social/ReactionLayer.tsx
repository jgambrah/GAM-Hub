'use client';

import React from 'react';
import { useVibePlayer, REACTIONS, type VibeReaction } from './VibePlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function ReactionLayer() {
  const { reactionBursts, sendReaction } = useVibePlayer();

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* ── Reaction Bursts ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {reactionBursts.map((burst) => (
          <motion.div
            key={burst.id}
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1.2, 1], y: -100 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute text-4xl select-none"
            style={{ left: `${burst.x}%`, top: `${burst.y}%` }}
          >
            {burst.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Controls — positioned at bottom right ───────────────────────────── */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 pointer-events-auto items-center animate-in slide-in-from-right-4">
        <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.2em] mb-1">React Live</p>
        <div className="flex gap-2 p-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="p-2 hover:scale-125 hover:-translate-y-1 transition-all active:scale-90 text-2xl"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
