'use client';

import React from 'react';
import Image from 'next/image';
import { useVibePlayer } from './VibePlayerContext';
import { cn } from '@/lib/utils';
import { History, Trash2, Youtube, Video, RotateCcw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function VibeHistoryPanel() {
  const { history, clearHistory, setActivePost, activePostId } = useVibePlayer();
  const [isOpen, setIsOpen] = React.useState(false);

  if (history.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all duration-300 active:scale-95',
          isOpen
            ? 'bg-foreground text-background border-foreground'
            : 'bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
        )}
      >
        <History size={14} />
        <span>Recently Played</span>
        <span className="bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {history.length}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-card border border-border rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <History size={14} className="text-blue-500" />
              <span className="text-xs font-black uppercase tracking-widest text-foreground">
                Session History
              </span>
            </div>
            <button
              onClick={() => { clearHistory(); setIsOpen(false); }}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 size={11} />
              Clear
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-none py-2">
            {history.map((post, i) => {
              const isCurrent = post.id === activePostId;
              return (
                <button
                  key={`${post.id}-${i}`}
                  onClick={() => { setActivePost(post); setIsOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 active:scale-[0.99] transition-all text-left',
                    isCurrent && 'bg-blue-500/10'
                  )}
                >
                  <div className="relative w-16 h-9 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
                    {post.imageUrl ? (
                      <Image src={post.imageUrl} alt="" fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {post.mediaType === 'youtube'
                          ? <Youtube size={14} className="text-red-500/60" />
                          : <Video size={14} className="text-slate-500" />
                        }
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground line-clamp-1 mb-0.5">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="w-3.5 h-3.5">
                        <AvatarImage src={post.authorAvatarUrl} />
                        <AvatarFallback className="text-[7px]">{post.authorName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-[9px] text-muted-foreground truncate">{post.authorName}</span>
                    </div>
                  </div>

                  {!isCurrent && (
                    <RotateCcw size={12} className="text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
