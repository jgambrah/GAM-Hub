'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import type { SocialPost, Product } from '@/lib/types';
import SocialPostCard from './social-post-card';
import VibeAdCard from './VibeAdCard';
import VibeMoodBar from './VibeMoodBar';
import VibeHistoryPanel from './VibeHistoryPanel';
import { useVibePlayer } from './VibePlayerContext';
import { useVibeAds, AD_INTERVAL } from '@/hooks/use-vibe-ads';
import { useSound } from '@/context/SoundContext';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, Zap, ShoppingBag, VolumeX, Volume2 } from 'lucide-react';
import ProductCard from '../products/product-card';

interface VibeFeedProps {
  posts: SocialPost[];
  products?: Product[];
  className?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

/**
 * VibeFeed Component
 * 
 * Finalized scroller architecture.
 * Interleaves Social Posts, Sponsored Ads, and Marketplace Products.
 */
export default function VibeFeed({ 
  posts, 
  products = [], 
  className, 
  hasMore, 
  onLoadMore, 
  isLoadingMore 
}: VibeFeedProps) {
  const {
    activePostId,
    isProfileLoaded,
    activeMood,
  } = useVibePlayer();

  const { soundOn, toggleSound } = useSound();
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
      { threshold: 0.1, rootMargin: '600px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // 🏗️ CONSTRUCT INTERLEAVED FEED
  const feedItems = useMemo(() => {
    const items: Array<
      | { type: 'post'; post: SocialPost; key: string }
      | { type: 'ad'; slotIndex: number; key: string }
      | { type: 'product'; product: Product; key: string }
    > = [];

    let adSlotCount = 0;
    let productSlotCount = 0;

    posts.forEach((post, i) => {
      items.push({ type: 'post', post, key: `${post.id}-${i}` });

      // RULE: Every 4 posts, inject a Marketplace Product if available
      if ((i + 1) % 4 === 0 && products.length > productSlotCount) {
          items.push({ 
            type: 'product', 
            product: products[productSlotCount], 
            key: `injected-prod-${products[productSlotCount].id}-${i}` 
          });
          productSlotCount++;
      }

      // RULE: Every AD_INTERVAL (5) posts, inject a Sponsored Ad slot
      if ((i + 1) % AD_INTERVAL === 0 && i < posts.length - 1) {
        items.push({ type: 'ad', slotIndex: adSlotCount, key: `ad-slot-${adSlotCount}-${i}` });
        adSlotCount++;
      }
    });

    return items;
  }, [posts, products]);

  const activePostItem = useMemo(() => {
    if (!activePostId) return null;
    return posts.find(p => p.id === activePostId);
  }, [activePostId, posts]);

  const discoveryItems = useMemo(() => {
    return feedItems.filter(item => {
      if (item.type === 'post' && item.post.id === activePostId) return false;
      return true;
    });
  }, [feedItems, activePostId]);

  const hasActive = !!activePostId;

  return (
    <div className={cn('flex flex-col gap-5 w-full', className)}>

      {/* Discovery Hub Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <VibeMoodBar />
        </div>
        <div className="flex items-center gap-2">
          {/* Global Sound Toggle */}
          <button 
            onClick={toggleSound}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-border bg-white dark:bg-slate-900 shadow-sm transition-all active:scale-95"
          >
            {!soundOn ? <VolumeX size={14} className="text-red-500" /> : <Volume2 size={14} className="text-blue-500" />}
            <span>{!soundOn ? 'Muted' : 'Sound On'}</span>
          </button>

          {isProfileLoaded && (
            <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-900">
              <Sparkles size={10} className="fill-indigo-600" /> Vibe Profile: ACTIVE
            </div>
          )}
          <VibeHistoryPanel />
        </div>
      </div>

      <div className="flex flex-col gap-10 w-full">
        {/* ACTIVE STAGE: Pinned at top */}
        {activePostItem && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <SocialPostCard post={activePostItem} />
          </div>
        )}

        {/* DISCOVERY GRID */}
        <div className={cn(
          'grid gap-8 transition-all duration-500',
          hasActive ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
        )}>
          {discoveryItems.map(item => {
            if (item.type === 'post') {
              return <SocialPostCard key={item.key} post={item.post} />;
            }

            if (item.type === 'product') {
                return (
                    <div key={item.key} className="space-y-3 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center gap-2 px-4">
                            <ShoppingBag size={14} className="text-amber-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Gear</span>
                        </div>
                        <ProductCard product={item.product} />
                    </div>
                );
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
        <div ref={sentinelRef} className="py-20 flex flex-col items-center justify-center gap-4">
            {isLoadingMore ? (
                <>
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-indigo-100 rounded-full animate-spin border-t-indigo-600" />
                        <Zap className="absolute inset-0 m-auto text-indigo-600" size={18} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Synching with Hub...</p>
                </>
            ) : hasMore ? (
                <div className="flex items-center gap-3 text-slate-200 dark:text-slate-800 transition-opacity group-hover:opacity-100 opacity-50">
                    <div className="h-[1px] w-12 bg-current" />
                    <Zap size={16} />
                    <div className="h-[1px] w-12 bg-current" />
                </div>
            ) : (
                <div className="text-center space-y-3 py-10 opacity-40">
                    <ShoppingBag className="mx-auto text-slate-300" size={32} />
                    <p className="text-xs font-black uppercase tracking-widest">Yard exploration complete</p>
                    <p className="text-[10px] font-medium italic">Refresh to find new vibrations and deals.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
