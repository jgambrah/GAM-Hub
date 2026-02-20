'use client';

import React, { useState, useRef } from 'react';
import { Radio, Play, Pause } from 'lucide-react';

export default function CampusRadio({ radioUrl, stationName }: { radioUrl: string, stationName: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleRadio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Set the source fresh each time play is clicked
      audioRef.current.src = radioUrl;
      audioRef.current.load(); // Important for some streaming URLs
      audioRef.current.play().catch(e => console.error("Radio play failed:", e));
    }
    setIsPlaying(!isPlaying);
  };
  
  // Add an event listener to handle the audio element's own play/pause events
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  return (
    <div className="mx-4 mb-6 p-6 bg-gradient-to-r from-blue-900 to-slate-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
      <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
         <Radio size={80} />
      </div>

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-white/10'} transition-all`}>
            <Radio size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Live on the Yard</p>
            <h3 className="text-xl font-black">{stationName}</h3>
          </div>
        </div>

        <button 
          onClick={toggleRadio}
          className="w-14 h-14 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
        >
          {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
        </button>
      </div>

      <audio ref={audioRef} preload="none" />
    </div>
  );
}
