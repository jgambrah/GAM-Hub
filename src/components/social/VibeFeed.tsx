'use client';

import React, { useMemo } from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import { useVibePlayer } from './VibePlayerContext';
import VibeMoodBar from './VibeMoodBar';
import { cn } from '@/lib/utils';
import { Sparkles, Zap } from 'lucide-react';

interface VibeFeedProps {
  posts: SocialPost[];
  searchQuery?: string;
  className?: string;
}

export default function VibeFeed({ posts, searchQuery, className }: VibeFeedProps) {
  const { activePostId, addToQueue, activeMood } = useVibePlayer();

  React.useEffect(() => {
    const mediaPosts = posts.filter(
      p => p.mediaType === 'youtube' || p.mediaType === 'video' || p.mediaType === 'tiktok'
    );
    if (mediaPosts.length > 0) addToQueue(mediaPosts);
  }, [posts.length, addToQueue]);

  const isSearchActive = !!searchQuery && searchQuery.trim().length > 0;
  
  const { projectedPost, gridPosts } = useMemo(() => {
    if (isSearchActive || !activePostId) {
      return { projectedPost: null, gridPosts: posts };
    }
    
    const active = posts.find(p => p.id === activePostId);
    if (!active) return { projectedPost: null, gridPosts: posts };

    const others = posts.filter(p => p.id !== activePostId);
    return { projectedPost: active, gridPosts: others };
  }, [posts, activePostId, isSearchActive]);

  return (
    <div className={cn('w-full space-y-8', className)}>
      
      {/* 🎭 MOOD BAR */}
      <VibeMoodBar />

      {/* 🎬 PROJECTED VIDEO (THEATER MODE) */}
      {projectedPost && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <SocialPostCard post={projectedPost} />
          
          <div className="mt-12 mb-6 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Sparkles size={16} className="text-blue-500" />
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {activeMood === 'all' ? 'More in the Yard' : `Discover more ${activeMood} vibes`}
                </h4>
              </div>
              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800 mx-6" />
          </div>
        </div>
      )}

      {/* 📱 FEED GRID (2-COLUMN ALIGNMENT) */}
      <div className={cn(
        "grid gap-6 transition-all duration-500",
        isSearchActive 
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
          : "grid-cols-1 sm:grid-cols-2"
      )}>
        {gridPosts.map(post => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>

      {posts.length === 0 && (
        <div className="py-32 text-center bg-white dark:bg-card rounded-[3rem] border-4 border-dashed border-slate-50 dark:border-slate-800">
          <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-xs">The Yard is Silent</p>
          <p className="text-xs text-slate-400 mt-2 italic">No vibes matching your search or mood were found.</p>
        </div>
      )}
    </div>
  );
}
