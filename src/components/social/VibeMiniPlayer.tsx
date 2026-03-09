'use client';

import React from 'react';
import Image from 'next/image';
import { useVibePlayer, VIBE_MOODS } from './VibePlayerContext';
import { cn } from '@/lib/utils';
import {
  Play, Pause, SkipBack, SkipForward, X,
  Youtube, Video, ChevronUp,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function VibeMiniPlayer() {
  const {
    activePost,
    activePostId,
    isMiniPlayerVisible,
    isContinuous,
    activeMood,
    playNext,
    playPrev,
    setActivePost,
  } = useVibePlayer();

  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isDismissed, setIsDismissed] = React.useState(false);
  const [isCardVisible, setIsCardVisible] = React.useState(true);

  React.useEffect(() => {
    if (!activePostId) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsCardVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );

    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-post-id="${activePostId}"]`);
      if (el) observer.observe(el);
    }, 500);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [activePostId]);

  React.useEffect(() => {
    setIsDismissed(false);
    setIsPlaying(true);
  }, [activePostId]);

  const shouldShow = isMiniPlayerVisible && !isCardVisible && !isDismissed && !!activePost;
  const moodDef = VIBE_MOODS.find(m => m.id === activeMood);

  const scrollToActive = () => {
    const el = document.querySelector(`[data-post-id="${activePostId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!activePost) return null;

  return (
    <div
      className={cn(
        'fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[4500] w-full max-w-2xl px-4 transition-all duration-500',
        shouldShow
          ? 'translate-y-0 opacity-100'
          : 'translate-y-24 opacity-0 pointer-events-none'
      )}
    >
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-[2rem] shadow-2xl shadow-black/20 overflow-hidden">
        <div className="h-0.5 bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full bg-blue-500 transition-all duration-1000',
              isPlaying && 'animate-[progressPulse_3s_ease-in-out_infinite]'
            )}
            style={{ width: '45%' }}
          />
        </div>

        <div className="flex items-center gap-4 px-5 py-3">
          <button
            onClick={scrollToActive}
            className="relative w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 flex-shrink-0 shadow-md hover:scale-105 transition-transform active:scale-95"
          >
            {activePost.imageUrl ? (
              <Image src={activePost.imageUrl} alt="" fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                {activePost.mediaType === 'youtube'
                  ? <Youtube size={16} className="text-red-500/70" />
                  : <Video size={16} className="text-slate-400" />
                }
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center">
              <ChevronUp size={14} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
            </div>
          </button>

          <button
            onClick={scrollToActive}
            className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          >
            <p className="text-sm font-bold text-foreground truncate leading-tight">
              {activePost.content}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Avatar className="w-4 h-4">
                <AvatarImage src={activePost.authorAvatarUrl} />
                <AvatarFallback className="text-[7px]">{activePost.authorName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground truncate">{activePost.authorName}</span>
              {moodDef && moodDef.id !== 'all' && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-black">
                  {moodDef.emoji} {moodDef.label}
                </span>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={playPrev} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all">
              <SkipBack size={16} />
            </button>

            <button
              onClick={() => setIsPlaying(p => !p)}
              className="w-10 h-10 flex items-center justify-center bg-foreground text-background rounded-2xl shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>

            <button onClick={playNext} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all">
              <SkipForward size={16} />
            </button>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}