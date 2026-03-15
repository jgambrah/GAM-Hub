
'use client';

/**
 * ArenaChampions Component
 * ------------------------
 * Displays top individual warriors in the Yard based on wins and votes received.
 * Now expanded to show Monetization Impact: Boosts Received & Coins Earned.
 */

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { ArenaLeaderboard } from '@/lib/types';
import { Trophy, Crown, Zap, Star, Medal, Coins } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

export function getRank(wins: number, highlightCount: number) {
  if (highlightCount >= 50) return { label: 'Arena Legend', color: 'bg-red-600', icon: '👑', textColor: 'text-white' };
  if (wins >= 25) return { label: 'Campus King', color: 'bg-amber-500', icon: '🤴', textColor: 'text-slate-950' };
  if (wins >= 10) return { label: 'Gold Contender', color: 'bg-yellow-400', icon: '🏆', textColor: 'text-slate-900' };
  if (wins >= 5) return { label: 'Silver Warrior', color: 'bg-slate-300', icon: '🥈', textColor: 'text-slate-700' };
  return { label: 'Bronze Aspirant', color: 'bg-orange-400', icon: '🥉', textColor: 'text-white' };
}

export function ArenaChampions() {
  const { firestore } = useFirebase();

  const leaderboardQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'arena_leaderboard'),
      orderBy('wins', 'desc'),
      limit(5)
    );
  }, [firestore]);

  const { data: champions, isLoading } = useCollection<ArenaLeaderboard>(leaderboardQuery);

  if (isLoading) {
    return (
      <div className="mx-4 mb-12 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
        </div>
      </div>
    );
  }

  if (!champions || champions.length === 0) return null;

  return (
    <section className="mx-4 mb-16 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-amber-500 rounded-xl shadow-lg">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tight text-foreground uppercase">Arena Champions</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Individual Warrior Rankings</p>
          </div>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200/50">
          Rankings Live
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {champions.map((champ, i) => {
          const rank = getRank(champ.wins, champ.highlightCount || 0);
          return (
            <div 
              key={champ.userId}
              className={cn(
                "relative bg-card p-6 rounded-[2.5rem] border-2 transition-all hover:shadow-2xl group overflow-hidden",
                i === 0 ? "border-amber-400 bg-gradient-to-br from-white to-amber-50 shadow-xl shadow-amber-100 dark:from-slate-900 dark:to-amber-950/20" : "border-slate-100 hover:border-primary/20"
              )}
            >
              <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
                {i === 0 ? <Crown size={100} /> : <Zap size={100} />}
              </div>

              <div className="flex items-center gap-5 relative z-10">
                <div className="relative">
                  <Avatar className={cn(
                    "h-16 w-16 border-4 shadow-xl group-hover:scale-105 transition-transform",
                    i === 0 ? "border-amber-400" : "border-white dark:border-slate-800"
                  )}>
                    <AvatarImage src={champ.avatarUrl} />
                    <AvatarFallback className="font-black text-lg">{champ.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-2 -right-2 px-2.5 py-1 rounded-lg text-[10px] font-black text-white shadow-lg",
                    i === 0 ? "bg-amber-500" : "bg-slate-900"
                  )}>
                    #{i + 1}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-lg text-foreground truncate flex items-center gap-2 leading-none">
                    {champ.name}
                    {i === 0 && <Star size={14} className="fill-amber-500 text-amber-500 animate-pulse" />}
                  </h3>
                  <div className={cn("mt-2 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest w-fit shadow-sm", rank.color, rank.textColor)}>
                    {rank.icon} {rank.label}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4 border-dashed border-slate-100 dark:border-slate-800">
                    <div className="text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Wins</p>
                      <p className="text-sm font-black text-foreground">{champ.wins}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Energy</p>
                      <p className="text-sm font-black text-amber-600">{champ.votes_received.toLocaleString()}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1"><Zap size={8} /> Boosts</p>
                      <p className="text-sm font-black text-blue-600">{champ.boostsReceived || 0}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1"><Coins size={8} /> Earned</p>
                      <p className="text-sm font-black text-emerald-600">{(champ.coinsEarned || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex justify-center opacity-30">
         <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Official Liaison Warrior Index • GH 🇬🇭</p>
      </div>
    </section>
  );
}
