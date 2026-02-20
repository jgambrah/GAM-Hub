'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Radio, Play, Pause, Volume2, Wifi, Loader2, AlertCircle } from 'lucide-react';
import type { Campus } from '@/lib/types';

/**
 * CampusRadio Component
 * 
 * Implements the "Liaison Pro-Stream" method.
 * Provides custom-designed controls for play/pause and volume,
 * while handling browser audio blocking and Error Code 4 detection.
 */
export default function CampusRadio({ campusId }: { campusId: string }) {
  const { firestore } = useFirebase();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasErrorCode4, setHasErrorCode4] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const campusDocRef = useMemoFirebase(() => {
    if (!firestore || !campusId) return null;
    return doc(firestore, 'campuses', campusId);
  }, [firestore, campusId]);

  const { data: campus } = useDoc<Campus>(campusDocRef);

  // Sync volume slider with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const toggleRadio = async () => {
    if (!audioRef.current || !campus?.radioStreamUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setIsLoading(true);
        setHasErrorCode4(false);
        
        // Force the browser to refresh the live stream buffer
        audioRef.current.src = campus.radioStreamUrl; 
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Audio block:", err);
        setIsLoading(false);
        // Liaison Note: Modern browsers require a user interaction before playing audio
        alert("Liaison Alert: Please click anywhere on the page first, then press play again to enable audio.");
      }
    }
  };

  if (!campus?.radioStreamUrl) return null;

  return (
    <div className={`mx-4 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border transition-all duration-500 ${
      hasErrorCode4 ? 'bg-red-950 border-red-500/50' : 'bg-slate-900 border-white/5'
    }`}>
      
      {/* THE AUDIO ENGINE */}
      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        preload="none" 
        onError={(e) => {
          const target = e.target as HTMLAudioElement;
          if (target.error?.code === 4) {
            setHasErrorCode4(true);
            setIsPlaying(false);
            setIsLoading(false);
          }
        }}
      />

      <div className="relative z-10 space-y-8">
        
        {/* TOP: STATUS */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl transition-all ${
              hasErrorCode4 ? 'bg-red-500/20 text-red-500' : isPlaying ? 'bg-blue-600 animate-pulse' : 'bg-white/10'
            }`}>
              <Radio size={24} />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${hasErrorCode4 ? 'text-red-400' : 'text-blue-400'}`}>
                {hasErrorCode4 ? 'Source Blocked' : isPlaying ? 'Live on Air' : 'Campus Waves'}
              </p>
              <h3 className="text-xl font-black">{campus.radioName || 'National Hub FM'}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasErrorCode4 && <AlertCircle className="text-red-500" size={20} />}
            <Wifi size={20} className={isPlaying ? 'text-green-500' : 'text-slate-600'} />
          </div>
        </div>

        {/* MIDDLE: CONTROLS */}
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleRadio}
            disabled={isLoading}
            className="w-20 h-20 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={32} />
            ) : isPlaying ? (
              <Pause fill="currentColor" size={32} />
            ) : (
              <Play fill="currentColor" size={32} className="ml-1" />
            )}
          </button>

          {/* CUSTOM VOLUME SLIDER */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
              <span>Volume</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Volume2 size={16} className="text-slate-400" />
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>

        {hasErrorCode4 ? (
          <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-center">
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">
              Check Link: This stream is blocked by HTTPS security or is an invalid source.
            </p>
            <button 
              onClick={() => window.open(campus.radioStreamUrl, '_blank')}
              className="mt-2 text-[9px] font-black text-white underline uppercase tracking-widest"
            >
              Open in External Player
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500 text-center font-medium italic">
            {isPlaying ? "Tuned into the live heartbeat of the Yard..." : "Click to connect to the campus waves."}
          </p>
        )}
      </div>
    </div>
  );
}
