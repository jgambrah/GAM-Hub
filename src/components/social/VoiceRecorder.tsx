
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
}

const MAX_DURATION_SECONDS = 60; // Safety Limit: 1 Minute

export default function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // AUTO-STOP Logic: Enforce 60s limit
  useEffect(() => {
    if (duration >= MAX_DURATION_SECONDS && isRecording) {
      stopRecording();
    }
  }, [duration, isRecording]);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        // CRITICAL: release all tracks immediately to free the hardware
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Liaison Mic Error:", err);
      alert("Microphone access denied. Please enable permissions in your browser to record voice vibes.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setAudioBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsPlaying(false);
    setDuration(0);
  };

  const handleSend = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (audioBlob) {
      onSend(audioBlob, duration);
      handleReset();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center w-full">
      {isRecording ? (
        <div className="flex flex-col items-center gap-4 bg-red-50 dark:bg-red-950/20 p-8 rounded-[2.5rem] animate-in zoom-in border-2 border-red-100 dark:border-red-900 shadow-xl w-full">
          <div className="relative">
            <div className="w-20 h-20 bg-red-600 rounded-full animate-ping absolute inset-0 opacity-20" />
            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center relative z-10">
                <Mic size={32} className="text-white animate-pulse" />
            </div>
          </div>
          
          <div className="text-center">
            <span className={cn(
                "text-2xl font-black tabular-nums",
                duration > 50 ? "text-amber-600" : "text-red-600"
            )}>
                {formatTime(duration)}
            </span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Recording Live Vibe</p>
          </div>

          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); stopRecording(); }}
            className="px-10 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all active:scale-90 shadow-lg"
          >
            Stop & Review
          </button>
        </div>
      ) : previewUrl ? (
        <div className="flex flex-col items-center gap-6 bg-slate-900 dark:bg-card p-8 rounded-[3rem] animate-in zoom-in-95 border-4 border-white/10 shadow-2xl w-full">
          <div className="flex items-center gap-4 w-full">
            <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); togglePlayback(); }}
                className="w-16 h-16 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center"
            >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
            
            <div className="flex-1 space-y-1">
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: isPlaying ? '100%' : '0%', transitionDuration: isPlaying ? `${duration}s` : '0s' }} />
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40 tracking-widest">
                    <span>Vibration Recorded</span>
                    <span className="text-white">{formatTime(duration)}</span>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); handleReset(); }}
                className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest border border-white/5"
            >
                <Trash2 size={16} /> Discard
            </button>
            <button 
                type="button" 
                onClick={handleSend}
                className="flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95"
            >
                <Send size={16} /> Attach Vibe
            </button>
          </div>
          <audio 
            ref={audioRef} 
            src={previewUrl} 
            onEnded={() => setIsPlaying(false)} 
            className="hidden" 
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.preventDefault(); startRecording(); }}
          className="group flex flex-col items-center gap-4 p-12 rounded-[3.5rem] bg-indigo-50 dark:bg-indigo-950/20 border-4 border-dashed border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 transition-all w-full"
        >
          <div className="p-6 bg-white dark:bg-slate-900 rounded-full shadow-xl group-hover:scale-110 transition-transform group-active:scale-95">
            <Mic size={48} className="text-indigo-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest">Speak to the Yard</p>
            <p className="text-[10px] text-indigo-400 font-bold mt-1 uppercase tracking-widest opacity-60 italic">Tap to start vocalizing</p>
          </div>
        </button>
      )}
    </div>
  );
}
