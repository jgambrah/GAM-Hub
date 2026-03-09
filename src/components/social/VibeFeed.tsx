'use client';

/**
 * VibeFeed
 * --------
 * Implements the Refined Theater-Grid layout.
 * - Active video is "Projected Big" at the very top of the feed stack.
 * - Remaining vibrations are neatly aligned in a two-column grid below.
 * - Intelligently minimizes to a standard grid during active search.
 * - No internal sidebar — relies on the page-level sidebar for the playlist.
 */

import React, { useMemo } from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import { useVibePlayer } from './VibePlayerContext';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface VibeFeedProps {
  posts: SocialPost[];
  searchQuery?: string;
  className?: string;
}

export default function VibeFeed({ posts, searchQuery, className }: VibeFeedProps) {
  const { activePostId, addToQueue } = useVibePlayer();

  // Register all media posts into the matching pool
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
    // If the active post isn't in the current posts array (e.g. filtered out), don't project it
    if (!active) return { projectedPost: null, gridPosts: posts };

    const others = posts.filter(p => p.id !== activePostId);
    
    return { projectedPost: active, gridPosts: others };
  }, [posts, activePostId, isSearchActive]);

  return (
    <div className={cn('w-full space-y-10', className)}>
      
      {/* 1. PROJECTED VIDEO (THEATER MODE) */}
      {projectedPost && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <SocialPostCard post={projectedPost} />
          
          <div className="mt-12 mb-6 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <Sparkles size={16} className="text-blue-500" />
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">More Vibrations in the Yard</h4>
              </div>
              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800 mx-6" />
          </div>
        </div>
      )}

      {/* 2. FEED GRID (2-COLUMN ALIGNMENT) */}
      <div className={cn(
        "grid gap-6 transition-all duration-500",
        isSearchActive 
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" // Standard discovery grid for search
          : "grid-cols-1 sm:grid-cols-2" // Clean 2-column grid for the rest
      )}>
        {gridPosts.map(post => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>

      {/* Empty State */}
      {posts.length === 0 && (
        <div className="py-32 text-center bg-white dark:bg-card rounded-[3rem] border-4 border-dashed border-slate-50 dark:border-slate-800">
          <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-xs">The Yard is Silent</p>
          <p className="text-xs text-slate-400 mt-2 italic">Be the first to share a vibration.</p>
        </div>
      )}
    </div>
  );
}
