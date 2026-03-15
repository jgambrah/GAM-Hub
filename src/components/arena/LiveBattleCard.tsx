
'use client';

import React from 'react';
import type { ArenaBattle } from '@/lib/types';
import { Swords, Users, Trophy, Zap, ChevronRight, Clock, ShieldCheck, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function LiveBattleCard({ battle, onClick }: { battle: ArenaBattle, onClick: () => void }) {
  const isWaiting = battle.status === 'waiting';
  const p1 = battle.participantInfo[battle.creatorId];
  const p2 = battle.opponentB ? battle.participantInfo[battle.opponentB.userId] : null;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-slate-950 rounded-[3rem] p-8 text-white relative overflow-hidden group cursor-pointer transition-all border-4",
        isWaiting ? "border-indigo-900/50 hover:border-indigo-500 shadow-xl" : "border-slate-900 hover:shadow-[0_0_50px_rgba(220,38,38,0.2)]"
      )}
    >
      {/* Dynamic Background Glow */}
      <div className={cn(
          "absolute inset-0 group-hover:opacity-30 transition-opacity animate-pulse",
          isWaiting ? "bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent)]" : "bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent)]"
      )} />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full animate-ping", isWaiting ? "bg-indigo-500" : "bg-red-600")} />
            <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isWaiting ? "text-indigo-400" : "text-red-500")}>
                {isWaiting ? "Challenge Open" : "Live Battle"}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2 text-white">
            {isWaiting ? <Clock size={12} className="text-indigo-400" /> : <Users size={12} className="text-slate-400" />}
            <span className="text-[10px] font-black tabular-nums">
                {isWaiting ? "Awaiting rival" : `${battle.viewerCount || 0} watching`}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Participant 1 */}
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 shadow-2xl" style={{ borderColor: p1?.primaryColor }}>
                <AvatarImage src={p1?.avatarUrl} />
                <AvatarFallback>{p1?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10 text-[8px] font-black uppercase">
                {p1?.campusAcronym}
              </div>
            </div>
            <p className="font-black text-sm truncate w-full text-center">{p1?.name}</p>
          </div>

          <div className="flex flex-col items-center">
            <div className={cn(
                "p-4 rounded-full shadow-2xl group-hover:scale-110 transition-transform",
                isWaiting ? "bg-slate-800 text-indigo-400 border border-indigo-500/30" : "bg-red-600 text-white shadow-red-500/50"
            )}>
              <Swords size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-500 mt-4 uppercase tracking-widest italic">VS</p>
          </div>

          {/* Participant 2 (or Placeholder) */}
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="relative">
              {p2 ? (
                <>
                    <Avatar className="h-20 w-20 border-4 shadow-2xl" style={{ borderColor: p2?.primaryColor }}>
                        <AvatarImage src={p2?.avatarUrl} />
                        <AvatarFallback>{p2?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10 text-[8px] font-black uppercase">
                        {p2?.campusAcronym}
                    </div>
                </>
              ) : (
                <div className="h-20 w-20 rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center bg-slate-900/50">
                    <Plus size={32} className="text-slate-700 animate-pulse" />
                </div>
              )}
            </div>
            <p className="font-black text-sm truncate w-full text-center text-slate-500">
                {p2 ? p2.name : 'Unknown Rival'}
            </p>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <h3 className="text-lg font-black italic tracking-tight mb-2">"{battle.title}"</h3>
          <button className={cn(
              "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 mx-auto transition-all active:scale-95",
              isWaiting ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-red-600 text-white hover:bg-red-500"
          )}>
            {isWaiting ? "Enter Challenge" : "Join the Ring"} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
