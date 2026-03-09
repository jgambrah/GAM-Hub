'use client';

/**
 * VibeFeed
 * --------
 * The main campus feed shell. Composes:
 *   - VibeMoodBar    — mood filter strip
 *   - VibeHistoryPanel — recently played dropdown
 *   - Feed grid      — SocialPostCards with expand-in-place active state
 *
 * The sidebar (UpNextPanel) is now handled by the parent page to prevent duplication.
 *
 * Usage:
 *   <VibeFeed posts={posts} />
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
  }, [posts.length, addToQueue]);

  const hasActive = !!activePostId;

  return (
    <div className={cn('flex flex-col gap-5 w-full', className)}>

      {/* ── Toolbar: mood bar + history button ─────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <VibeMoodBar />
        </div>
        <VibeHistoryPanel />
      </div>

      {/* ── Feed Grid ──────────────────────────────────────────────────────── */}
      {/* 
          Theater-Grid Protocol: 
          If a vibe is active, we go single column to let it claim the full width.
          Otherwise, we show a professional two-column discovery grid.
      */}
      <div className={cn(
        'grid gap-6 transition-all duration-500 min-w-0',
        hasActive ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
      )}>
        {posts.map(post => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
