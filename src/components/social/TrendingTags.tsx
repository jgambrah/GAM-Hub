'use client';

import React from 'react';
import { Hash, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';

interface TrendingTagsProps {
    onTagSelect?: (tag: string) => void;
    activeTag?: string;
}

/**
 * TrendingTags Component
 * 
 * Fetches real-time hashtag data from the 'hashtags' collection.
 * Ranks by postCount to show the Yard's hottest topics.
 */
export default function TrendingTags({ onTagSelect, activeTag = 'All' }: TrendingTagsProps) {
  const { firestore } = useFirebase();

  const hashtagsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'hashtags'),
      orderBy('postCount', 'desc'),
      limit(10)
    );
  }, [firestore]);

  const { data: hashtags, isLoading } = useCollection<any>(hashtagsQuery);

  const handleTagClick = (tagName: string) => {
    if (onTagSelect) {
      onTagSelect(tagName);
    }
  };

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button 
            onClick={() => handleTagClick('All')}
            className={cn(
                "flex-shrink-0 flex items-center gap-2 bg-card border px-4 py-2 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all active:scale-95",
                activeTag === 'All' ? "border-primary shadow-md bg-primary/5" : "border-border"
            )}
        >
            <Hash size={14} className={activeTag === 'All' ? 'text-primary' : 'text-muted-foreground'} />
            <span className={cn("text-xs font-bold", activeTag === 'All' ? 'text-primary' : 'text-card-foreground')}>All Vibes</span>
        </button>

        {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-2">
                <Loader2 className="animate-spin text-muted-foreground" size={14} />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Indexing...</span>
            </div>
        ) : hashtags?.map((tag) => {
            const isActive = activeTag === tag.tag || activeTag === `#${tag.tag}`;
            return (
              <button 
                key={tag.tag}
                onClick={() => handleTagClick(tag.tag)}
                className={cn(
                    "flex-shrink-0 flex items-center gap-2 bg-card border px-4 py-2 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all active:scale-95",
                    isActive ? "border-primary shadow-md bg-primary/5 text-primary" : "border-border"
                )}
              >
                <Hash size={14} className={isActive ? 'text-primary' : 'text-blue-500'} />
                <span className={cn("text-xs font-bold")}>{tag.tag}</span>
                <span className="text-[10px] font-black text-muted-foreground/60">{tag.postCount.toLocaleString()}</span>
              </button>
            )
        })}
    </div>
  );
}
