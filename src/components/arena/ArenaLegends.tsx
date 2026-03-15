
'use client';

/**
 * ArenaLegends Component
 * ----------------------
 * National Hub for Arena Legends.
 * Ranks creators based on their frequency in the official Highlight Archive.
 */

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { ArenaLeaderboard } from '@/lib/types';
import { Crown, Zap, Flame, Trophy, Star, Loader2, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

export function ArenaLegends() {
  const { firestore } = useFirebase();

  // 1. NATIONAL RETRIEVAL: Top 5 legends by Highlight Appearances
  const legendsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'arena_leaderboard'),
      orderBy('highlightCount', 'desc'),
      limit(5)
    );
  }, [firestore]);

  const { data: legends, isLoading } = useCollection<ArenaLeaderboard>(legendsQuery);

  if (isLoading) {
    return (
      <div className="mx-4 mb-16 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="bg-slate-900/5 p-8 rounded-[3rem] border-2 border-dashed">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  // Only show if legends exist with highlight counts
  const filteredLegends = legends?.filter(l => (l.highlightCount || 0) > 0) || [];
  if (filteredLegends.length === 0) return null;

  return (
    <section className="mx-4 mb-16 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-lg">
            <Crown size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tight text-foreground uppercase">Arena Legends</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hall of Highlight Fame</p>
          </div>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200/50 flex items-center gap-2">
          <Sparkles size={12} className="animate-pulse" />
          Legendary Status
        </div>
      </div>

      <div className="bg-slate-950 rounded-[3.5rem] p-8 border-4 border-slate-900 shadow-2xl relative overflow-hidden">
        {/* Background Watermark */}
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none rotate-12">
          <Crown size={300} className="text-amber-500" />
        </div>

        <div className="relative z-10 space-y-4">
          {filteredLegends.map((legend, i) => (
            <div 
              key={legend.userId}
              className={cn(
                "flex items-center justify-between p-4 rounded-3xl border transition-all hover:scale-[1.02] active:scale-[0.98]",
                i === 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/5 hover:bg-white/10"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <span className={cn(
                    "absolute -left-2 -top-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black z-20 shadow-lg",
                    i === 0 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-white"
                  )}>
                    {i + 1}
                  </span>
                  <Avatar className="h-14 w-14 border-2 border-white/10">
                    <AvatarImage src={legend.avatarUrl} />
                    <AvatarFallback className="font-black text-slate-400">{legend.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <h3 className={cn(
                    "font-black text-base tracking-tight",
                    i === 0 ? "text-amber-400" : "text-white"
                  )}>
                    {legend.name}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{legend.campusAcronym} HUB</p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-2xl font-black text-white tabular-nums">{legend.highlightCount}</span>
                  <div className="p-1.5 bg-amber-500/20 text-amber-500 rounded-lg">
                    <Zap size={14} fill="currentColor" />
                  </div>
                </div>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Highlights Logged</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center opacity-30">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Official Liaison Legend Registry • GH 🇬🇭</p>
        </div>
      </div>
    </section>
  );
}
