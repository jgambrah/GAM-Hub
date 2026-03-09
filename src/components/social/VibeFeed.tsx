'use client';

/**
 * VibeFeed
 * --------
 * The main campus feed shell. Composes:
 *   - VibeMoodBar    — mood filter strip
 *   - VibeHistoryPanel — recently played dropdown
 *   - Theater-Top Feed — Ensures active vibe is always solo at the top.
 */

import React from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import VibeMoodBar from './VibeMoodBar';
import VibeHistoryPanel from './VibeHistoryPanel';
import { useVibePlayer } from './VibePlayerContext';
import { cn } from '@/lib/utils';

interface VibeFeedProps {
  posts: SocialPost[];
  className?: string;
}

export default function VibeFeed({ posts, className }: VibeFeedProps) {
  const { activePostId, addToQueue } = useVibePlayer();

  // Register ALL posts into the global pool on mount
  React.useEffect(() => {
    if (posts.length > 0) addToQueue(posts);
  }, [posts, addToQueue]);

  // LIAISON THEATER LOGIC: Identify the active post to float it to the top
  const activePost = posts.find(p => p.id === activePostId);
  const otherPosts = posts.filter(p => p.id !== activePostId);

  return (
    <div className={cn('flex flex-col gap-5 w-full', className)}>

      {/* ── Toolbar: mood bar + history button ─────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <VibeMoodBar />
        </div>
        <VibeHistoryPanel />
      </div>

      {/* ── Feed Layout ────────────────────────────────────────────────────── */}
      <div className="space-y-8">
        
        {/* 1. THE STAGE: Active Vibe solo at the top */}
        {activePost && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <SocialPostCard post={activePost} />
          </div>
        )}

        {/* 2. THE DISCOVERY GRID: Remaining vibes in a professional 2-column layout */}
        <div className={cn(
          'grid gap-6 transition-all duration-500 min-w-0',
          activePostId ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
        )}>
          {otherPosts.map(post => (
            <SocialPostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}
