'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import type { SocialPost } from '@/lib/types';
import SocialPostCard from './social-post-card';
import VibeAdCard from './VibeAdCard';
import VibeMoodBar from './VibeMoodBar';
import VibeHistoryPanel from './VibeHistoryPanel';
import { useVibePlayer } from './VibePlayerContext';
import { useVibeAds, AD_INTERVAL } from '@/hooks/use-vibe-ads';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, Zap } from 'lucide-react';
import { enforceDiversity } from '@/lib/diversity-engine';

interface VibeFeedProps {
  posts: SocialPost[];
  className?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

/**
 * VibeFeed Component
 * 
 * Implements the "Infinite Feed Scroller".
 * Uses an Intersection Observer sentinel to trigger automatic batch fetching.
 */
export default function VibeFeed({ posts, className, hasMore, onLoadMore, isLoadingMore }: VibeFeedProps) {
  const {
    activePostId, addToQueue,
    sortFeedByProfile, isProfileLoaded,
    activeMood,
  } = useVibePlayer();

  const { getAdForSlot, recordImpression, recordClick } = useVibeAds(activeMood);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ♾️ INFINITE SCROLL ENGINE: Sentinel Observer
  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '400px' } // Fetch 400px before reaching the end
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Build the interleaved feed: post, post, post, post, post, AD, post, post...
  const feedItems = useMemo(() => {
    const items: Array<
      | { type: 'post'; post: SocialPost; key: string }
      | { type: 'ad'; slotIndex: number; key: string }
    > = [];

    let adSlotCount = 0;

    posts.forEach((post, i) => {
      items.push({ type: 'post', post, key: `${post.id}-${i}` });

      // After every AD_INTERVAL posts, inject an ad slot
      if ((i + 1) % AD_INTERVAL === 0 && i < posts.length - 1) {
        items.push({ type: 'ad', slotIndex: adSlotCount, key: `ad-slot-${adSlotCount}-${i}` });
        adSlotCount++;
      }
    });

    return items;
  }, [posts]);

  // ── THEATER PRIORITY: Extract the active post to stay at the top ──
  const activePostItem = useMemo(() => {
    if (!activePostId) return null;
    return posts.find(p => p.id === activePostId);
  }, [activePostId, posts]);

  // Filter out the active post from the discovery grid list to prevent duplicates
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

      <div className="flex flex-col gap-8 w-full">
        {/* ACTIVE HERO STAGE */}
        {activePostItem && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <SocialPostCard post={activePostItem} />
          </div>
        )}

        {/* DISCOVERY GRID */}
        <div className={cn(
          'grid gap-6 transition-all duration-500',
          hasActive ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
        )}>
          {discoveryItems.map(item => {
            if (item.type === 'post') {
              return <SocialPostCard key={item.key} post={item.post} />;
            }

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

        {/* ♾️ INFINITE SCROLL SENTINEL */}
        <div ref={sentinelRef} className="py-12 flex flex-col items-center justify-center gap-4">
            {isLoadingMore ? (
                <>
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Calibrating Next Vibe Batch...</p>
                </>
            ) : hasMore ? (
                <div className="flex items-center gap-2 text-slate-300 opacity-50">
                    <Zap size={14} />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em]">Continuum Node Active</span>
                </div>
            ) : (
                <div className="text-center space-y-2 opacity-40">
                    <p className="text-xs font-black uppercase tracking-widest">You've reached the Yard boundary.</p>
                    <p className="text-[10px] font-medium italic">Refresh to find new vibrations.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
