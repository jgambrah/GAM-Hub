'use client';

import React from 'react';
import { Hash, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendingTagsProps {
    onTagSelect?: (tag: string) => void;
    activeTag?: string;
}

export default function TrendingTags({ onTagSelect, activeTag = 'All' }: TrendingTagsProps) {
  // Hardcoded for now, but your Cloud Function will eventually update these
  const tags = [
    { name: 'KNUSTGrad', count: 120, color: 'text-orange-500' },
    { name: 'HostelLife', count: 85, color: 'text-blue-500' },
    { name: 'LegonNightMarket', count: 64, color: 'text-emerald-500' },
    { name: 'YardDeals', count: 42, color: 'text-purple-500' },
  ];
  
  const allTags = [{ name: 'All', count: 0, color: 'text-muted-foreground' }, ...tags];

  const handleTagClick = (tagName: string) => {
    if (onTagSelect) {
      onTagSelect(tagName);
    }
  };

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {allTags.map((tag) => {
            const isActive = activeTag === tag.name;
            return (
              <button 
                key={tag.name}
                onClick={() => handleTagClick(tag.name)}
                className={cn(
                    "flex-shrink-0 flex items-center gap-2 bg-card border px-4 py-2 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all active:scale-95",
                    isActive ? "border-primary shadow-md bg-primary/5" : "border-border"
                )}
              >
                <Hash size={14} className={isActive ? 'text-primary' : tag.color} />
                <span className={cn("text-xs font-bold", isActive ? 'text-primary' : 'text-card-foreground')}>{tag.name}</span>
                {tag.name !== 'All' && tag.count > 0 && <span className="text-[10px] font-black text-muted-foreground">{tag.count}</span>}
              </button>
            )
        })}
    </div>
  );
}
