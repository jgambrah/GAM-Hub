
'use client';

/**
 * CampusWarLeaderboard Component
 * ------------------------------
 * National University Rankings.
 * Features a prestigious "Championship Podium" layout tracking inter-uni war dominance.
 */

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { CampusLeaderboard, Campus } from '@/lib/types';
import { Trophy, Crown, Zap, Star, Medal, Landmark, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { campuses as staticCampuses } from '@/lib/data';

export function CampusWarLeaderboard() {
  const { firestore } = useFirebase();

  // 1. NATIONAL RETRIEVAL: Top 5 Universities by Wins
  const leaderboardQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'campus_leaderboard'),
      orderBy('wins', 'desc'),
      limit(5)
    );
  }, [firestore]);

  const { data: rankings, isLoading } = useCollection<CampusLeaderboard>(leaderboardQuery);

  if (isLoading) {
    return (
      <div className="mx-4 mb-12 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="bg-slate-900/5 p-8 rounded-[3rem] border-2 border-dashed">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!rankings || rankings.length === 0) return null;

  const maxWins = rankings[0]?.wins || 1;

  return (
    <section className="mx-4 mb-16 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg">
            <Landmark size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tight text-foreground uppercase">National Hub Rankings</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Inter-University Dominance</p>
          </div>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-200/50 flex items-center gap-2">
          <Globe size={12} className="animate-spin-slow" />
          Hub Verified
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
        {/* Background Watermark */}
        <div className="absolute right-0 top-0 p-8 opacity-5 pointer-events-none rotate-12">
          <Trophy size={200} className="text-indigo-600" />
        </div>

        <div className="relative z-10 space-y-6">
          {rankings.map((rank, i) => {
            const campusInfo = staticCampuses.find(c => c.id === rank.id);
            const acronym = campusInfo?.acronym || rank.id.toUpperCase();
            const pct = (rank.wins / maxWins) * 100;

            return (
              <div key={rank.id} className="group relative">
                <div className="flex justify-between items-end mb-2 px-2">
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "text-xl font-black italic transition-colors",
                      i === 0 ? "text-amber-500" : "text-slate-300 group-hover:text-foreground"
                    )}>
                      0{i + 1}
                    </span>
                    <div>
                      <h3 className="font-black text-lg text-foreground tracking-tighter uppercase leading-none">
                        {acronym}
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {rank.wins} WINS • {rank.losses} LOSSES
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-indigo-600 tabular-nums">
                      {(rank.totalVotes || 0).toLocaleString()}
                    </p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Energy</p>
                  </div>
                </div>

                <div className="h-3 w-full bg-slate-50 dark:bg-slate-800/50 rounded-full overflow-hidden p-0.5 border border-slate-100 dark:border-slate-800 relative">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-out",
                      i === 0 ? "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]" : "bg-indigo-600"
                    )}
                    style={{ width: `${pct}%`, backgroundColor: campusInfo?.primaryColor }}
                  />
                  {i === 0 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Crown size={12} className="text-amber-500 animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center opacity-40">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">National Victory Registry • GH 🇬🇭</p>
           <Landmark size={14} className="text-indigo-600" />
        </div>
      </div>
    </section>
  );
}
