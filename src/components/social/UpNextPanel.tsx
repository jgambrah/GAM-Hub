'use client';

import React from 'react';
import Image from 'next/image';
import { useVibePlayer, type QueueEntry } from './VibePlayerContext';
import { cn } from '@/lib/utils';
import { Youtube, Video, Zap, ListVideo, Loader2, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function UpNextPanel() {
  const { 
    activePost, 
    upNext, 
    isLoadingQueue, 
    isContinuous, 
    setActivePost, 
    setIsContinuous,
    activeMood 
  } = useVibePlayer();

  if (!activePost) return null;

  return (
    <div className="w-full flex flex-col gap-3 max-h-[calc(100vh-3rem)] overflow-y-auto scrollbar-none pb-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
        <div className="flex items-center gap-2">
          <ListVideo size={16} className="text-blue-500" />
          <span className="text-sm font-black uppercase tracking-widest text-foreground">
            Up Next
          </span>
          {isLoadingQueue && (
            <Loader2 size={12} className="animate-spin text-blue-400" />
          )}
        </div>

        <button
          onClick={() => setIsContinuous(!isContinuous)}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300',
            isContinuous ? 'bg-blue-500' : 'bg-muted'
          )}
          aria-label="Toggle autoplay"
        >
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transform transition-transform duration-300',
              isContinuous ? 'translate-x-[18px]' : 'translate-x-[3px]'
            )}
          />
        </button>
      </div>

      {/* ── Mood Badge ─────────────────────────────────────────────────────── */}
      {activeMood !== 'all' && (
        <div className="bg-slate-900 text-white rounded-2xl px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 mx-1">
          <span className="text-xs">✨</span>
          <span className="text-[10px] font-black uppercase tracking-widest">
            {activeMood} vibe enabled
          </span>
        </div>
      )}

      {/* ── Now Playing pill ───────────────────────────────────────────────── */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-2.5 flex items-center gap-2 mx-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex-shrink-0">
          Now Playing
        </span>
        <span className="text-[10px] text-foreground/70 truncate flex-1">
          {activePost.content}
        </span>
      </div>

      {/* ── Queue list ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        {upNext.length === 0 && !isLoadingQueue ? (
          <div className="text-center py-8 text-muted-foreground text-xs italic">
            No similar vibes found yet — keep scrolling!
          </div>
        ) : (
          upNext.map((entry, i) => (
            <UpNextCard
              key={entry.post.id}
              entry={entry}
              position={i + 1}
              onSelect={() => setActivePost(entry.post)}
            />
          ))
        )}

        {isLoadingQueue && upNext.length === 0 && (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UpNextCard({
  entry,
  position,
  onSelect,
}: {
  entry: QueueEntry;
  position: number;
  onSelect: () => void;
}) {
  const { post, reason } = entry;
  const isYoutube = post.mediaType === 'youtube';

  return (
    <button
      onClick={onSelect}
      className="group w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-muted/60 active:scale-[0.98] transition-all text-left"
    >
      <div className="relative w-24 h-[54px] rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 shadow-sm">
        {post.imageUrl ? (
          <Image src={post.imageUrl} alt="" fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            {isYoutube ? <Youtube size={18} className="text-red-500/60" /> : <Video size={18} />}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <ChevronRight
            size={18}
            className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
          />
        </div>
        <div className="absolute bottom-1 left-1.5 bg-black/70 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">
          {position}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground line-clamp-2 leading-snug mb-1">
          {post.content}
        </p>
        <div className="flex items-center gap-1.5 mb-1">
          <Avatar className="w-4 h-4">
            <AvatarImage src={post.authorAvatarUrl || ''} />
            <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-[9px] text-muted-foreground truncate">{post.authorName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap size={8} className="text-blue-400 flex-shrink-0" />
          <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider truncate">
            {reason}
          </span>
        </div>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-2xl animate-pulse">
      <div className="w-24 h-[54px] rounded-xl bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-2 bg-muted rounded w-2/3" />
        <div className="h-2 bg-muted/60 rounded w-1/3" />
      </div>
    </div>
  );
}