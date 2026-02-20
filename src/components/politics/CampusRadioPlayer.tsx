'use client';

import React, { useState, useRef } from 'react';
import { Radio, Play, Pause, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATION_MAP: Record<string, { name: string; url: string }> = {
  'ug': { name: 'Radio Univers 105.7', url: 'https://stream.radio-univers.com/live' },
  'knust': { name: 'Focus FM 94.3', url: 'https://stream.focusfm.com/live' },
  'ucc': { name: 'Atlantic Radio 103.9', url: 'https://stream.atlantic.com/live' },
  // Default fallback
  'default': { name: 'Campus Voice Radio', url: 'https://stream.zeno.fm/s4cq43avz68uv' },
};

export function CampusRadioPlayer({ campusId }: { campusId: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(false);
  const station = STATION_MAP[campusId] || STATION_MAP['default'];
  const audioRef = useRef<HTMLAudioElement | null>(null);


  const toggleRadio = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setError(false);
        audioRef.current.src = station.url;
        audioRef.current.load(); 
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
      } catch (err) {
        console.error("Playback prevented:", err);
        setError(true);
        setIsPlaying(false);
      }
    }
  };
  
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
        setError(true);
        setIsPlaying(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    // Cleanup listeners
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, []);


  return (
    <div className="mx-4 mb-10 p-1 bg-gradient-to-r from-red-600 via-purple-600 to-blue-600 rounded-[3rem] shadow-2xl shadow-purple-200">
      <div className="bg-slate-950 rounded-[2.8rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        
        {/* Animated Background Pulse */}
        {isPlaying && (
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none" />
        )}

        <div className="flex items-center gap-6 relative z-10">
          <div className={`p-5 rounded-[2rem] ${isPlaying ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : error ? 'bg-red-500/20' : 'bg-white/10'} transition-all duration-500`}>
            {error ? <AlertTriangle size={32} className="text-red-500" /> : <Radio size={32} className="text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isPlaying ? "bg-red-500 animate-ping" : "bg-slate-500")} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Live Campus Waves</p>
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">{station.name}</h3>
            <p className="text-xs text-slate-400 font-medium italic mt-1">"The Voice of the Yard"</p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
          <div className="hidden lg:flex items-center gap-1">
             {[0.2, 0.5, 0.8, 0.4, 0.9, 0.3].map((h, i) => (
               <div key={i} className={`w-1 bg-blue-400 rounded-full transition-all duration-300 ${isPlaying ? 'animate-bounce' : 'h-2'}`} style={{ height: isPlaying ? `${h * 40}px` : '8px', animationDelay: `${i * 0.1}s` }} />
             ))}
          </div>
          <button 
            onClick={toggleRadio}
            className="flex-1 md:flex-none bg-white text-slate-900 px-10 py-4 rounded-[1.8rem] font-black text-sm flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
          >
            {isPlaying ? <><Pause size={20} fill="currentColor" /> Stop Waves</> : <><Play size={20} fill="currentColor" /> Tune In</>}
          </button>
        </div>
      </div>
      <audio ref={audioRef} preload="none" />
    </div>
  );
}