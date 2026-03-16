
'use client';

/**
 * TournamentBracketView Component
 * ------------------------------
 * Displays the "John vs Sarah" style pairings for a tournament.
 * Synchronized with the real-time matches sub-collection.
 */

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { ArenaMatch } from '@/lib/types';
import { Swords, Trophy, Zap, ChevronRight, Loader2, Star, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TournamentBracketViewProps {
  tournamentId: string;
}

export function TournamentBracketView({ tournamentId }: TournamentBracketViewProps) {
  const { firestore } = useFirebase();

  // 1. Fetch current matches for the tournament
  const matchesQuery = useMemoFirebase(() => {
    if (!firestore || !tournamentId) return null;
    return query(
      collection(firestore, 'arena_tournaments', tournamentId, 'matches'),
      orderBy('round', 'asc'),
      orderBy('createdAt', 'asc'),
      limit(20)
    );
  }, [firestore, tournamentId]);

  const { data: matches, isLoading } = useCollection<ArenaMatch>(matchesQuery);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="py-10 text-center opacity-30">
        <Swords size={32} className="mx-auto mb-3" />
        <p className="text-[10px] font-black uppercase tracking-widest">Bracket generation pending</p>
      </div>
    );
  }

  // Group matches by round for logical display
  const rounds = matches.reduce((acc: Record<number, ArenaMatch[]>, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  const currentRound = Math.max(...Object.keys(rounds).map(Number));

  return (
    <div className="space-y-8 pb-4">
      {Object.entries(rounds).reverse().map(([roundNum, roundMatches]) => (
        <div key={roundNum} className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500">Round {roundNum}</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>
          
          <div className="space-y-2">
            {roundMatches.map((match) => (
              <div 
                key={match.id}
                className={cn(
                    "p-4 rounded-2xl border transition-all flex items-center justify-between group",
                    match.status === 'live' ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/5"
                )}
              >
                <div className="flex items-center gap-4 flex-1">
                    {/* Player A */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="relative">
                            <Avatar className="h-8 w-8 border border-white/10 shadow-lg">
                                <AvatarImage src={match.playerAAvatar} />
                                <AvatarFallback className="text-[8px]">{match.playerAName[0]}</AvatarFallback>
                            </Avatar>
                            {match.winner === match.playerA && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 border border-slate-900 shadow-lg animate-in zoom-in">
                                    <Star size={8} fill="currentColor" className="text-white" />
                                </div>
                            )}
                        </div>
                        <p className={cn(
                            "text-xs font-black truncate",
                            match.winner === match.playerA ? "text-amber-400" : "text-slate-300"
                        )}>
                            {match.playerAName.split(' ')[0]}
                        </p>
                    </div>

                    <div className="px-2">
                        <span className="text-[8px] font-black text-slate-600 uppercase italic">VS</span>
                    </div>

                    {/* Player B */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
                        <p className={cn(
                            "text-xs font-black truncate",
                            match.winner === match.playerB ? "text-amber-400" : "text-slate-300"
                        )}>
                            {match.playerBName.split(' ')[0]}
                        </p>
                        <div className="relative">
                            <Avatar className="h-8 w-8 border border-white/10 shadow-lg">
                                <AvatarImage src={match.playerBAvatar} />
                                <AvatarFallback className="text-[8px]">{match.playerBName[0]}</AvatarFallback>
                            </Avatar>
                            {match.winner === match.playerB && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 border border-slate-900 shadow-lg animate-in zoom-in">
                                    <Star size={8} fill="currentColor" className="text-white" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                    {match.status === 'live' ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded-full animate-pulse shadow-lg shadow-red-900/40">
                            <Zap size={10} fill="white" className="text-white" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-white">LIVE</span>
                        </div>
                    ) : match.status === 'completed' ? (
                        <CheckCircle2 size={14} className="text-emerald-500 opacity-50" />
                    ) : (
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Waiting</div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
