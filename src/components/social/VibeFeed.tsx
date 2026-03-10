'use client';

import React, { useMemo } from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
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

  // 1. Register ALL posts into the global pool on mount
  React.useEffect(() => {
    if (posts.length > 0) addToQueue(posts);
  }, [posts, addToQueue]);

  // 2. PERSISTENT SORTING LAYER
  // On app open, we sort the feed by the user's historical taste profile.
  const sortedPosts = useMemo(() => {
    return sortFeedByProfile(posts);
  }, [posts, sortFeedByProfile]);

  const activePost = sortedPosts.find(p => p.id === activePostId);
  const otherPosts = sortedPosts.filter(p => p.id !== activePostId);

  return (
    <div className={cn('flex flex-col gap-5 w-full', className)}>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <VibeMoodBar />
        </div>
        
        {isProfileLoaded && (
          <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-2xl flex items-center gap-2 border border-amber-100 dark:border-amber-800 animate-in fade-in">
            <Sparkles size={14} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">✦ For You</span>
          </div>
        )}
        
        <VibeHistoryPanel />
      </div>

      {/* ── Feed Layout ────────────────────────────────────────────────────── */}
      <div className="space-y-8">
        
        {/* 1. THE STAGE: Active Vibe hero slot */}
        {activePost && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <SocialPostCard post={activePost} />
          </div>
        )}

        {/* 2. THE DISCOVERY GRID: Two-column discover mode */}
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
