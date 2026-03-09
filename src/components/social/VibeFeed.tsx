'use client';

/**
 * VibeFeed
 * --------
 * The main campus feed shell. Composes:
 *   - VibeMoodBar    — mood filter strip
 *   - VibeHistoryPanel — recently played dropdown
 *   - Post grid      — SocialPostCards with expand-in-place active state
 *   - UpNextPanel    — smart queue sidebar (slides in when something plays)
 *
 * Usage:
 *   <VibeFeed posts={posts} />
 */

import React from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import UpNextPanel from './UpNextPanel';
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

  // Register ALL posts — text, image, video, youtube, tiktok
  // The queue engine handles them all; no pre-filtering here
  React.useEffect(() => {
    if (posts.length > 0) addToQueue(posts);
  }, [posts.length, addToQueue]); // Added addToQueue to dependencies

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

      {/* ── Feed + sidebar ──────────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start w-full">

        {/* Post grid - Refined to 2 columns for a more premium look */}
        <div className={cn(
          'grid gap-6 transition-all duration-500 min-w-0',
          !hasActive && 'grid-cols-1 lg:grid-cols-2 flex-1',
          hasActive  && 'grid-cols-1 flex-1'
        )}>
          {posts.map(post => (
            <SocialPostCard key={post.id} post={post} />
          ))}
        </div>

        {/* Up Next sidebar */}
        <div className={cn(
          'flex-shrink-0 transition-all duration-500 overflow-hidden',
          hasActive
            ? 'w-80 opacity-100 translate-x-0'
            : 'w-0 opacity-0 translate-x-4 pointer-events-none'
        )}>
          <div className="sticky top-6">
            <UpNextPanel />
          </div>
        </div>

      </div>
    </div>
  );
}
