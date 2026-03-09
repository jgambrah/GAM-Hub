'use client';

import React, { useMemo } from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import UpNextPanel from './UpNextPanel';
import { useVibePlayer } from './VibePlayerContext';
import { cn } from '@/lib/utils';

interface VibeFeedProps {
  posts: SocialPost[];
  searchQuery?: string;
  className?: string;
}

/**
 * VibeFeed
 * --------
 * Implements the Theater-Grid layout.
 * - Active video is "Projected Big" at the top.
 * - Remaining videos are aligned in two rows (2-column grid) below.
 * - Persistent "Up Next" playlist stays on the side.
 * - Reverts to standard grid if a search is active.
 */
export default function VibeFeed({ posts, searchQuery, className }: VibeFeedProps) {
  const { activePostId, addToQueue } = useVibePlayer();

  // Register all media posts into the matching engine
  React.useEffect(() => {
    const mediaPosts = posts.filter(
      p => p.mediaType === 'youtube' || p.mediaType === 'video' || p.mediaType === 'tiktok'
    );
    if (mediaPosts.length > 0) addToQueue(mediaPosts);
  }, [posts.length, addToQueue]);

  const isSearchActive = !!searchQuery && searchQuery.trim().length > 0;
  
  // Identify the projected post and the remaining grid items
  const { projectedPost, gridPosts } = useMemo(() => {
    if (isSearchActive || !activePostId) {
      return { projectedPost: null, gridPosts: posts };
    }
    
    const active = posts.find(p => p.id === activePostId);
    const others = posts.filter(p => p.id !== activePostId);
    
    return { projectedPost: active, gridPosts: others };
  }, [posts, activePostId, isSearchActive]);

  return (
    <div className={cn('flex flex-col lg:flex-row gap-8 items-start w-full', className)}>
      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────── */}
      <div className="flex-1 w-full space-y-10 min-w-0">
        
        {/* 1. PROJECTED VIDEO (THEATER MODE) */}
        {projectedPost && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <SocialPostCard post={projectedPost} />
            <div className="mt-8 mb-4 px-2 flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">More Vibrations in the Yard</h4>
                <div className="h-[1px] flex-1 bg-slate-100 mx-4" />
            </div>
          </div>
        )}

        {/* 2. TWO-COLUMN GRID (REMAINDER) */}
        <div className={cn(
          "grid gap-6 transition-all duration-500",
          isSearchActive 
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" // Standard discovery grid for search
            : "grid-cols-1 sm:grid-cols-2" // 2-column grid as requested
        )}>
          {gridPosts.map(post => (
            <SocialPostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* ── SIDBAR PLAYLIST (UP NEXT) ─────────────────────────────────────── */}
      <aside className={cn(
        "hidden lg:block flex-shrink-0 sticky top-24 transition-all duration-500",
        (projectedPost || isSearchActive) ? "w-[350px] opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-4 pointer-events-none"
      )}>
        <UpNextPanel />
      </aside>
    </div>
  );
}
