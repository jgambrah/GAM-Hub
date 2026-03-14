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
        // Stop all tracks to release the microphone
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
    <div className="flex items-center gap-2">
      {isRecording ? (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 px-4 py-2 rounded-2xl animate-in slide-in-from-left-2 border border-red-100 dark:border-red-900 shadow-sm min-w-[140px]">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          <span className={cn(
            "text-xs font-black tabular-nums",
            duration > 50 ? "text-amber-600 animate-bounce" : "text-red-600"
          )}>
            {formatTime(duration)} / 1:00
          </span>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); stopRecording(); }}
            className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all active:scale-90"
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>
      ) : previewUrl ? (
        <div className="flex items-center gap-2 bg-slate-900 dark:bg-card p-2 rounded-2xl animate-in zoom-in-95 border border-white/10 shadow-2xl min-w-[200px]">
          <button 
            type="button" 
            onClick={(e) => { e.preventDefault(); togglePlayback(); }}
            className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-500 transition-all"
          >
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
          </button>
          
          <div className="flex-1 px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white">{formatTime(duration)}</span>
          </div>

          <div className="flex gap-1">
            <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); handleReset(); }}
                className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                title="Discard"
            >
                <Trash2 size={16} />
            </button>
            <button 
                type="button" 
                onClick={handleSend}
                className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-500 transition-all active:scale-95 flex items-center gap-2"
                title="Attach Voice"
            >
                <Send size={16} />
                <span className="text-[10px] font-black uppercase hidden sm:inline">Attach</span>
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
          className="p-2.5 text-muted-foreground hover:text-primary transition-all hover:scale-110 active:scale-90 disabled:opacity-30 flex items-center gap-2 group"
          title="Record Voice Vibe"
        >
          <Mic size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Speak to the Yard</span>
        </button>
      )}
    </div>
  );
}
