'use client';

import React from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import UpNextPanel from './UpNextPanel';
import { useVibePlayer } from './VibePlayerContext';
import { cn } from '@/lib/utils';

interface VibeFeedProps {
  posts: SocialPost[];
  className?: string;
}

/**
 * VibeFeed
 * --------
 * Wraps the post grid and handles the active-card expansion layout.
 *
 * Layout rules:
 *  - When nothing is active: standard 1–3 col grid
 *  - When something is active: single column so col-span-full works
 */
export default function VibeFeed({ posts, className }: VibeFeedProps) {
  const { activePostId, addToQueue } = useVibePlayer();

  // Seed the full pool once on mount / when posts change
  React.useEffect(() => {
    const mediaPosts = posts.filter(
      p => p.mediaType === 'youtube' || p.mediaType === 'video' || p.mediaType === 'tiktok'
    );
    if (mediaPosts.length > 0) addToQueue(mediaPosts);
  }, [posts.length, addToQueue]);

  const hasActive = !!activePostId;

  return (
    <div className={cn('flex flex-col lg:flex-row gap-8 items-start w-full', className)}>
      {/* ── Post grid ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'grid gap-6 transition-all duration-500 min-w-0 w-full',
          !hasActive && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          hasActive && 'grid-cols-1 flex-1'
        )}
      >
        {posts.map(post => (
          <SocialPostCard key={post.id} post={post} />
        ))}
      </div>

      {/* ── Up Next sidebar ────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden lg:block flex-shrink-0 transition-all duration-500 overflow-hidden sticky top-24',
          hasActive
            ? 'w-full max-w-[350px] opacity-100 translate-x-0'
            : 'w-0 opacity-0 translate-x-4 pointer-events-none'
        )}
      >
        <UpNextPanel />
      </aside>
    </div>
  );
}
