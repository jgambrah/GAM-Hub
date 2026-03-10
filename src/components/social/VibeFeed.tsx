'use client';

import React, { useMemo } from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import UpNextPanel from './UpNextPanel';
import VibeMoodBar from './VibeMoodBar';
import VibeHistoryPanel from './VibeHistoryPanel';
import { useVibePlayer } from './VibePlayerContext';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface VibeFeedProps {
  posts: SocialPost[];
  className?: string;
}

export default function VibeFeed({ posts, className }: VibeFeedProps) {
  const { activePostId, addToQueue, sortFeedByProfile, isProfileLoaded } = useVibePlayer();

  // Register ALL posts into the global queue pool
  React.useEffect(() => {
    if (posts.length > 0) addToQueue(posts);
  }, [posts.length, addToQueue]);

  // Sort the rendered feed by personal profile as soon as the profile loads.
  // This is what makes the feed feel personalised on every app open —
  // posts matching the user's taste history float to the top automatically.
  const sortedPosts = useMemo(() => {
    return sortFeedByProfile(posts);
  }, [posts, isProfileLoaded, sortFeedByProfile]);

  const activePost = sortedPosts.find(p => p.id === activePostId);
  const otherPosts = sortedPosts.filter(p => p.id !== activePostId);

  return (
    <div className={cn('flex flex-col gap-5 w-full', className)}>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <VibeMoodBar />
        </div>
        <div className="flex items-center gap-2">
          {/* Subtle badge when the feed is personalised */}
          {isProfileLoaded && (
            <div className="flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-xl animate-in fade-in">
              <Sparkles size={9} />
              For You
            </div>
          )}
          <VibeHistoryPanel />
        </div>
      </div>

      {/* ── Feed Layout ────────────────────────────────────────────────────── */}
      <div className="space-y-8">
        
        {/* 1. THE STAGE: Active Vibe hero slot */}
        {activePost && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <SocialPostCard post={activePost} />
          </div>
        )}

        {/* 2. THE DISCOVERY GRID: Two-column grid layout */}
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
