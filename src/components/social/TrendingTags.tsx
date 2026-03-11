
'use client';

import React from 'react';
import { Hash, TrendingUp, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';

interface TrendingTagsProps {
    onTagSelect?: (tag: string) => void;
    activeTag?: string;
    useLinks?: boolean;
}

/**
 * TrendingTags Component
 * 
 * Elite discovery UI for the Yard.
 * Fetches real-time hashtag data from the 'hashtags' collection registry.
 * Ranks by trendScore (velocity) to show the Yard's hottest topics.
 * 
 * Thresholds:
 * - score > 30 → Viral 🔥
 * - score > 15 → Trending 📈
 */
export default function TrendingTags({ onTagSelect, activeTag = 'All', useLinks = false }: TrendingTagsProps) {
  const { firestore } = useFirebase();

  const hashtagsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'hashtags'),
      // Ordered by the Liaison Velocity Engine (calculated every 5m)
      orderBy('trendScore', 'desc'),
      limit(15)
    );
  }, [firestore]);

  const { data: hashtags, isLoading } = useCollection<any>(hashtagsQuery);

  const handleTagClick = (tagName: string) => {
    if (onTagSelect) {
      onTagSelect(tagName);
    }
  };

  const renderTag = (tag: any, index: number) => {
    const tagName = tag.tag;
    const isActive = activeTag === tagName || activeTag === `#${tagName}`;
    
    // 🛡️ LIAISON VIRAL THRESHOLDS
    const isViral = tag.trendScore > 30;
    const isTrending = tag.trendScore > 15;

    const content = (
        <>
            <span className={cn(
                "text-sm group-hover:scale-125 transition-transform",
                isViral && !isActive ? "animate-bounce" : ""
            )}>
                {isViral ? '🔥' : isTrending ? '📈' : '#'}
            </span>
            <span className="uppercase tracking-widest">{tagName}</span>
            {tag.postCount > 0 && (
                <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.5 rounded-lg",
                    isActive ? "bg-white/20 text-white" : "bg-slate-50 text-slate-400"
                )}>
                    {tag.postCount.toLocaleString()}
                </span>
            )}
        </>
    );

    const className = cn(
        "flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs transition-all active:scale-95 border-2 shadow-sm group",
        isActive 
            ? "bg-blue-600 text-white border-blue-600 shadow-xl" 
            : isViral
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-amber-50"
                : "bg-white border-slate-100 text-slate-700 hover:border-blue-200"
    );

    if (useLinks) {
        return (
            <Link key={tagName} href={`/hashtag/${tagName}`} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <button key={tagName} onClick={() => handleTagClick(tagName)} className={className}>
            {content}
        </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp size={12} /> Hottest Vibrations
        </h3>
        {isLoading && <Loader2 className="animate-spin text-slate-300" size={12} />}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {!useLinks && (
            <button 
                onClick={() => handleTagClick('All')}
                className={cn(
                    "flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs transition-all active:scale-95 border-2 shadow-sm",
                    activeTag === 'All' 
                        ? "bg-slate-900 text-white border-slate-900 shadow-xl" 
                        : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"
                )}
            >
                <span className="text-sm">🌍</span>
                <span className="uppercase tracking-widest">All Vibes</span>
            </button>
          )}

          {!isLoading && hashtags?.map((tag, index) => renderTag(tag, index))}

          {!isLoading && (!hashtags || hashtags.length === 0) && (
            <div className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-muted/50 border-2 border-dashed border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest italic">
              Awaiting First Vibes...
            </div>
          )}
      </div>
    </div>
  );
}
