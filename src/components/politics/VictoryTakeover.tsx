'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { Trophy, X } from 'lucide-react';

interface VictoryTakeoverProps {
  winner: {
    id: string;
    name: string;
    image: string;
    position: string;
    campusId: string;
    victoryMessage: string;
  };
  onDismiss: () => void;
}

/**
 * VictoryTakeover Component
 * 
 * A high-impact global overlay that triggers when a new campus winner is announced.
 * Uses Framer Motion for animations and Confetti for celebration.
 */
export function VictoryTakeover({ winner, onDismiss }: VictoryTakeoverProps) {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Confetti needs absolute pixel values for the viewport
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/95 p-6 backdrop-blur-xl overflow-hidden"
      >
        <Confetti 
          width={windowSize.width} 
          height={windowSize.height} 
          numberOfPieces={300} 
          recycle={false}
          gravity={0.1}
          colors={['#f59e0b', '#fbbf24', '#ffffff', '#1e293b']}
        />
        
        <motion.div 
          initial={{ scale: 0.8, y: 40, rotate: -2 }}
          animate={{ scale: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", damping: 15, stiffness: 100 }}
          className="relative max-w-md w-full bg-gradient-to-b from-amber-400 to-amber-600 rounded-3xl p-1.5 shadow-[0_0_100px_rgba(245,158,11,0.4)]"
        >
          <div className="bg-slate-950 rounded-[3.2rem] p-10 text-center relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(245,158,11,0.2),transparent)] pointer-events-none" />

            <button 
              onClick={onDismiss}
              className="absolute top-8 right-8 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all z-20"
            >
              <X size={24} />
            </button>

            <div className="flex justify-center mb-8 relative z-10">
              <div className="p-6 bg-amber-500 rounded-full shadow-[0_0_40px_rgba(245,158,11,0.6)]">
                <Trophy size={60} className="text-slate-950" />
              </div>
            </div>

            <h1 className="text-amber-500 font-black text-4xl mb-2 tracking-tighter italic uppercase leading-none">
              Winner Elect
            </h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-8">
              Official SRC Result: {winner.campusId}
            </p>

            <div className="relative w-44 h-44 mx-auto mb-8">
                <div className="absolute inset-0 bg-amber-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                <div className="relative w-full h-full border-4 border-amber-500 rounded-full overflow-hidden shadow-2xl z-10">
                    <img 
                      src={winner.image || `https://picsum.photos/seed/${winner.name}/400/400`} 
                      alt={winner.name} 
                      className="object-cover w-full h-full" 
                    />
                </div>
            </div>

            <h2 className="text-3xl font-black text-white mb-1 tracking-tight">{winner.name}</h2>
            <p className="text-amber-500 font-black uppercase text-xs tracking-widest mb-10">Your New {winner.position}</p>

            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 mb-10 relative">
              <p className="text-slate-300 text-sm italic font-medium leading-relaxed">
                "{winner.victoryMessage || 'A new chapter of excellence begins for our campus today.'}"
              </p>
            </div>

            <button 
              onClick={onDismiss}
              className="w-full py-6 bg-amber-500 text-slate-950 font-black rounded-2xl hover:bg-amber-400 transition-all active:scale-95 uppercase tracking-widest shadow-[0_10px_30px_rgba(245,158,11,0.3)] text-sm"
            >
              Salute the Yard
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}