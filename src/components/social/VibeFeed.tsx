
'use client';

import React, { useMemo } from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import VibeAdCard from './VibeAdCard';
import VibeMoodBar from './VibeMoodBar';
import VibeHistoryPanel from './VibeHistoryPanel';
import { useVibePlayer } from './VibePlayerContext';
import { useVibeAds, AD_INTERVAL } from '@/hooks/use-vibe-ads';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface VibeFeedProps {
  posts: SocialPost[];
  className?: string;
}

export default function VibeFeed({ posts, className }: VibeFeedProps) {
  const {
    activePostId, addToQueue,
    sortFeedByProfile, isProfileLoaded,
    activeMood,
  } = useVibePlayer();

  const { getAdForSlot, recordImpression, recordClick } = useVibeAds(activeMood);

  // Register all posts into the global queue pool
  React.useEffect(() => {
    if (posts.length > 0) addToQueue(posts);
  }, [posts.length, addToQueue]);

  // Sort feed by personal taste profile on app open
  const sortedPosts = useMemo(
    () => sortFeedByProfile(posts),
    [posts, isProfileLoaded, sortFeedByProfile]
  );

  // Build the interleaved feed: post, post, post, post, post, AD, post, post...
  const feedItems = useMemo(() => {
    const items: Array<
      | { type: 'post'; post: SocialPost; key: string }
      | { type: 'ad'; slotIndex: number; key: string }
    > = [];

    let adSlotCount = 0;

    sortedPosts.forEach((post, i) => {
      items.push({ type: 'post', post, key: post.id });

      // After every AD_INTERVAL posts, inject an ad slot
      if ((i + 1) % AD_INTERVAL === 0 && i < sortedPosts.length - 1) {
        items.push({ type: 'ad', slotIndex: adSlotCount, key: `ad-slot-${adSlotCount}` });
        adSlotCount++;
      }
    });

    return items;
  }, [sortedPosts]);

  // ── LIAISON VISUAL PRIORITY: Extract the active post to stay at the top ──
  const activePostItem = useMemo(() => {
    if (!activePostId) return null;
    return sortedPosts.find(p => p.id === activePostId);
  }, [activePostId, sortedPosts]);

  // Filter out the active post from the discovery grid list
  const discoveryItems = useMemo(() => {
    return feedItems.filter(item => {
      if (item.type === 'post' && item.post.id === activePostId) return false;
      return true;
    });
  }, [feedItems, activePostId]);

  const hasActive = !!activePostId;

  return (
    <div className={cn('flex flex-col gap-5 w-full', className)}>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <VibeMoodBar />
        </div>
        <div className="flex items-center gap-2">
          {isProfileLoaded && (
            <div className="flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-xl">
              <Sparkles size={9} /> For You
            </div>
          )}
          <VibeHistoryPanel />
        </div>
      </div>

      {/* Main Layout: Top Active Stage + Grid */}
      <div className="flex flex-col gap-8 w-full">
        
        {/* THE HERO STAGE: Active vibration stays at the very top */}
        {activePostItem && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <SocialPostCard post={activePostItem} />
          </div>
        )}

        {/* THE DISCOVERY GRID: Two-column protocol for visual impact */}
        <div className={cn(
          'grid gap-6 transition-all duration-500',
          hasActive ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
        )}>
          {discoveryItems.map(item => {
            if (item.type === 'post') {
              return <SocialPostCard key={item.key} post={item.post} />;
            }

            // Ad slot
            const ad = getAdForSlot(item.slotIndex);
            if (!ad) return null;

            return (
              <VibeAdCard
                key={item.key}
                ad={ad}
                onImpression={recordImpression}
                onClickCta={recordClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
