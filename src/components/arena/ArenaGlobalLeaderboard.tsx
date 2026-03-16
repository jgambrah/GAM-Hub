
'use client';

/**
 * ArenaGlobalLeaderboard Component
 * --------------------------------
 * The national engine for competition and prestige.
 * Features 4 high-stakes categories: Elite (Wins), Heat (Best Streaks), Wealth (Earnings), Weekly (Champs).
 * Now includes STEP 9: National Rewards Visibility.
 */

import React, { useState } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { ArenaLeaderboard } from '@/lib/types';
import { 
    Trophy, Crown, Zap, Flame, Coins, 
    TrendingUp, Calendar, Medal, Star, ShieldCheck, Gem, Gift
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type LeaderboardTab = 'wins' | 'streaks' | 'earnings' | 'weekly';

export function ArenaGlobalLeaderboard() {
  const { firestore } = useFirebase();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('wins');

  // 1. DATA RETRIEVAL: Dynamic Query based on Active Tab
  const leaderboardQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    // MAP: Logic to sort by specific competitive dimensions
    const sortField = {
        wins: 'wins',
        streaks: 'bestStreak', // All-time records for "Longest Streaks"
        earnings: 'coinsEarned', // Wealth Prestige
        weekly: 'weeklyWins' // Current cycle
    }[activeTab];

    return query(
      collection(firestore, 'arena_leaderboard'),
      orderBy(sortField, 'desc'),
      limit(20)
    );
  }, [firestore, activeTab]);

  const { data: leaderboard, isLoading } = useCollection<ArenaLeaderboard>(leaderboardQuery);

  const getRankBadge = (wins: number, highlightCount: number) => {
    if (highlightCount >= 50) return { label: 'Arena Legend', icon: Crown, color: 'bg-red-600' };
    if (wins >= 25) return { label: 'Campus King', icon: Trophy, color: 'bg-amber-500' };
    return { label: 'Citizen Warrior', icon: ShieldCheck, color: 'bg-slate-700' };
  };

  return (
    <section className="mx-4 mb-16 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 px-2 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-amber-500 rounded-xl shadow-lg">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tight text-foreground uppercase">National Rankings</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Official Yard Warrior Index</p>
          </div>
        </div>
        <div className="flex bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200/50 items-center gap-2 w-fit">
          <TrendingUp size={12} /> Real-time Handshake Active
        </div>
      </div>

      {/* 🏆 STEP 9: WEEKLY REWARDS HUD */}
      {activeTab === 'weekly' && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-500">
              {[
                  { rank: '#1 Weekly', prize: '5,000', label: 'Gold Champ', color: 'bg-amber-500', icon: Crown },
                  { rank: '#2 Weekly', prize: '2,000', label: 'Silver Elite', color: 'bg-slate-300', icon: Medal },
                  { rank: '#3 Weekly', prize: '1,000', label: 'Bronze Warrior', color: 'bg-orange-400', icon: Star },
              ].map((r) => (
                  <div key={r.rank} className="bg-slate-900 rounded-[2rem] p-6 border-2 border-white/5 relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><r.icon size={80}/></div>
                      <div className="flex items-center gap-3 mb-3">
                          <div className={cn("p-2 rounded-xl text-slate-950", r.color)}>
                              <r.icon size={16} />
                          </div>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{r.rank}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-white italic tracking-tighter">{r.prize}</span>
                          <span className="text-[10px] font-bold text-amber-500 uppercase">Coins</span>
                      </div>
                      <p className="text-[9px] font-black text-slate-500 uppercase mt-2 tracking-[0.2em]">{r.label} Protocol</p>
                  </div>
              ))}
          </div>
      )}

      <Tabs defaultValue="wins" className="w-full" onValueChange={(v) => setActiveTab(v as LeaderboardTab)}>
        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1.5 rounded-[2.5rem] h-auto mb-8 border shadow-sm">
          <TabsTrigger value="wins" className="rounded-[1.8rem] py-3 font-black text-[10px] uppercase tracking-widest">🏆 Elite</TabsTrigger>
          <TabsTrigger value="streaks" className="rounded-[1.8rem] py-3 font-black text-[10px] uppercase tracking-widest">🔥 Heat</TabsTrigger>
          <TabsTrigger value="earnings" className="rounded-[1.8rem] py-3 font-black text-[10px] uppercase tracking-widest">💰 Wealth</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-[1.8rem] py-3 font-black text-[10px] uppercase tracking-widest">👑 Weekly</TabsTrigger>
        </TabsList>

        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none rotate-12">
                <Trophy size={300} className="text-amber-500" />
            </div>

            <div className="relative z-10 divide-y divide-slate-50 dark:divide-slate-800">
                {isLoading ? (
                    <div className="p-10 space-y-6">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl bg-muted/50" />)}
                    </div>
                ) : leaderboard && leaderboard.length > 0 ? (
                    leaderboard.map((warrior, i) => {
                        const badge = getRankBadge(warrior.wins, warrior.highlightCount || 0);
                        return (
                            <div key={warrior.userId} className={cn(
                                "flex items-center justify-between p-6 transition-all hover:bg-slate-50 dark:hover:bg-white/5",
                                i === 0 && "bg-amber-50/30 dark:bg-amber-900/10"
                            )}>
                                <div className="flex items-center gap-5">
                                    <div className="relative">
                                        <span className={cn(
                                            "absolute -left-2 -top-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black z-20 shadow-lg",
                                            i === 0 ? "bg-amber-500 text-slate-950" : i === 1 ? "bg-slate-300 text-slate-700" : i === 2 ? "bg-orange-400 text-white" : "bg-slate-800 text-white"
                                        )}>
                                            {i + 1}
                                        </span>
                                        <Avatar className="h-14 w-14 border-2 border-white dark:border-slate-800 shadow-md">
                                            <AvatarImage src={warrior.avatarUrl} />
                                            <AvatarFallback className="font-black text-slate-400">{warrior.name[0]}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-black text-base text-foreground truncate">{warrior.name}</h3>
                                            {warrior.winStreak >= 3 && <Flame size={14} className="text-red-500 fill-current animate-bounce" />}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                {warrior.campusAcronym}
                                            </span>
                                            <div className={cn("px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest text-white flex items-center gap-1", badge.color)}>
                                                <badge.icon size={8} /> {badge.label}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    {activeTab === 'wins' && (
                                        <>
                                            <p className="text-2xl font-black text-foreground tabular-nums">{warrior.wins}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Wins</p>
                                        </>
                                    )}
                                    {activeTab === 'streaks' && (
                                        <>
                                            <p className="text-2xl font-black text-red-600 tabular-nums">{warrior.bestStreak}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Longest Streak</p>
                                        </>
                                    )}
                                    {activeTab === 'earnings' && (
                                        <>
                                            <div className="flex items-center gap-1 justify-end">
                                                <Coins size={16} className="text-emerald-500" />
                                                <span className="text-2xl font-black text-foreground tabular-nums">{(warrior.coinsEarned || 0).toLocaleString()}</span>
                                            </div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Coins Accumulated</p>
                                        </>
                                    )}
                                    {activeTab === 'weekly' && (
                                        <>
                                            <p className="text-2xl font-black text-indigo-600 tabular-nums">{warrior.weeklyWins}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Wins This Cycle</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-20 text-center opacity-30">
                        <Calendar size={64} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Awaiting First Vibrations</p>
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-muted/20 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg"><Gift size={12}/></div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Weekly Rewards: 5K • 2K • 1K COINS</p>
                </div>
                <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500 uppercase">
                    <Zap size={10} className="text-amber-500" fill="currentColor" /> National Ledger Sync: ON
                </div>
            </div>
        </div>
      </Tabs>
    </section>
  );
}
