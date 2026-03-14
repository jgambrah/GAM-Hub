
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob) => void;
  disabled?: boolean;
}

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
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
      alert("Microphone access denied. Please enable permissions.");
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

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob);
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
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 px-4 py-2 rounded-2xl animate-in slide-in-from-left-2 border border-red-100 dark:border-red-900">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          <span className="text-xs font-black text-red-600 tabular-nums">{formatTime(duration)}</span>
          <button 
            type="button"
            onClick={stopRecording}
            className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all active:scale-90"
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>
      ) : previewUrl ? (
        <div className="flex items-center gap-2 bg-muted p-1.5 rounded-2xl animate-in zoom-in-95">
          <button 
            type="button"
            onClick={togglePlayback}
            className="p-2 bg-slate-900 text-white dark:bg-primary rounded-xl"
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </button>
          <span className="text-[10px] font-bold px-2">Preview</span>
          <button 
            type="button"
            onClick={handleReset}
            className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button 
            type="button"
            onClick={handleSend}
            className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
          >
            <Send size={14} />
          </button>
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
          onClick={startRecording}
          className="p-2.5 text-muted-foreground hover:text-primary transition-all hover:scale-110 active:scale-90 disabled:opacity-30"
          title="Send Voice Vibe"
        >
          <Mic size={22} />
        </button>
      )}
    </div>
  );
}
