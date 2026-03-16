
'use client';

/**
 * TournamentSection Component
 * --------------------------
 * National Hub stage for structured Arena competitions.
 * Features real-time registration tracking and prize pool scaling.
 */

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { ArenaTournament } from '@/lib/types';
import { Trophy, Users, Zap, Coins, ChevronRight, Loader2, Star, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { JoinTournamentDialog } from './JoinTournamentDialog';

export function TournamentSection() {
  const { firestore } = useFirebase();

  // 1. NATIONAL RETRIEVAL: Active tournaments in registration or ongoing phase
  const tournamentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'arena_tournaments'),
      where('status', 'in', ['registration', 'ongoing']),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
  }, [firestore]);

  const { data: tournaments, isLoading } = useCollection<ArenaTournament>(tournamentsQuery);

  if (isLoading) {
    return (
      <div className="mx-4 mb-12 space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-[3rem]" />
          <Skeleton className="h-64 rounded-[3rem]" />
        </div>
      </div>
    );
  }

  if (!tournaments || tournaments.length === 0) return null;

  return (
    <section className="mx-4 mb-16 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-amber-500 rounded-xl shadow-lg">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tight text-foreground uppercase">National Tournaments</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Structured High-Stakes Combat</p>
          </div>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200/50">
          Season 1
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tournaments.map((tourney) => (
          <TournamentCard key={tourney.id} tourney={tourney} />
        ))}
      </div>
    </section>
  );
}

function TournamentCard({ tourney }: { tourney: ArenaTournament }) {
  const isRegistration = tourney.status === 'registration';
  const progress = (tourney.currentPlayers / tourney.maxPlayers) * 100;

  return (
    <div className={cn(
        "bg-slate-950 rounded-[3.5rem] p-10 text-white relative overflow-hidden group border-4 border-slate-900 transition-all hover:shadow-[0_0_80px_rgba(245,158,11,0.15)]",
        isRegistration ? "border-amber-500/30" : "border-indigo-500/30"
    )}>
      {/* Background Graphic */}
      <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
        <Trophy size={250} />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-2 h-2 rounded-full", isRegistration ? "bg-amber-500 animate-pulse" : "bg-red-600 animate-ping")} />
                <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isRegistration ? "text-amber-400" : "text-red-500")}>
                    {isRegistration ? "Registration Open" : "War in Progress"}
                </span>
            </div>
            <h3 className="text-3xl font-black italic tracking-tighter uppercase">{tourney.name}</h3>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-center">
             <div className="flex items-center gap-2 justify-center text-amber-500 mb-1">
                <Zap size={14} fill="currentColor" />
                <span className="text-[8px] font-black uppercase tracking-widest">Prize Pool</span>
             </div>
             <p className="text-2xl font-black tabular-nums">{tourney.prizePool.toLocaleString()} <span className="text-[10px] uppercase opacity-50">Coins</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Battle Entry</p>
                <div className="flex items-center justify-center gap-2">
                    <Coins size={16} className="text-amber-500" />
                    <span className="text-xl font-black">{tourney.entryFeeCoins}</span>
                </div>
            </div>
            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Army Size</p>
                <div className="flex items-center justify-center gap-2">
                    <Users size={16} className="text-blue-400" />
                    <span className="text-xl font-black">{tourney.currentPlayers}/{tourney.maxPlayers}</span>
                </div>
            </div>
        </div>

        {/* REGISTRATION PROGRESS BAR */}
        <div className="mb-10">
            <div className="flex justify-between items-end mb-2 px-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enlistment Progress</span>
                <span className="text-xs font-black text-amber-500">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
                <div 
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>

        <div className="flex gap-4">
            <JoinTournamentDialog tournament={tourney}>
                <button className="flex-1 bg-white text-slate-950 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-amber-400 transition-all active:scale-95 flex items-center justify-center gap-2">
                    Join Tournament <ChevronRight size={16} />
                </button>
            </JoinTournamentDialog>
            <button className="p-5 bg-white/5 border border-white/10 rounded-[2rem] text-slate-400 hover:bg-white/10 transition-all">
                <ShieldCheck size={24} />
            </button>
        </div>
      </div>
    </div>
  );
}
