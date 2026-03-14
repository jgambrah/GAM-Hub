
'use client';

/**
 * @fileOverview Liaison Voice Player Component.
 * A premium, interactive audio player for Yard voice vibrations.
 * Features a custom seeker, play/pause state, and waveform styling.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoicePlayerProps {
  url: string;
  duration?: number;
  theme?: 'light' | 'dark' | 'primary';
}

export default function VoicePlayer({ url, duration: initialDuration, theme = 'primary' }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };
    const handleLoadedMetadata = () => {
        setDuration(audio.duration);
        setIsLoading(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    // If metadata is already loaded (browser cache)
    if (audio.readyState >= 1) {
        setDuration(audio.duration);
        setIsLoading(false);
    }

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isPrimary = theme === 'primary';

  return (
    <div className={cn(
        "flex items-center gap-3 p-3 rounded-2xl border transition-all max-w-full",
        isPrimary ? "bg-primary/5 border-primary/10" : "bg-muted border-transparent"
    )}>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      
      <button 
        onClick={togglePlayback}
        className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-90 flex-shrink-0",
            isPrimary ? "bg-primary text-white" : "bg-slate-900 text-white"
        )}
      >
        {isLoading ? <Loader2 className="animate-spin" size={18} /> : isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="relative h-6 flex items-center group">
            {/* Visual Waveform (CSS Decoration) */}
            <div className="absolute inset-0 flex items-center justify-between gap-0.5 pointer-events-none opacity-20">
                {[...Array(20)].map((_, i) => (
                    <div 
                        key={i} 
                        className={cn("w-[2px] rounded-full bg-current", isPrimary ? "text-primary" : "text-slate-400")}
                        style={{ height: `${20 + Math.random() * 60}%` }}
                    />
                ))}
            </div>
            
            <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className={cn(
                    "w-full h-1 appearance-none bg-transparent cursor-pointer relative z-10 accent-primary",
                    "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-slate-200 dark:[&::-webkit-slider-runnable-track]:bg-slate-700",
                    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:mt-[-4px]"
                )}
            />
        </div>
        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
        </div>
      </div>

      <Volume2 size={12} className="text-muted-foreground/40 flex-shrink-0" />
    </div>
  );
}
