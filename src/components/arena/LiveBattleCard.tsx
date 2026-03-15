
'use client';

import React from 'react';
import type { ArenaBattle } from '@/lib/types';
import { Swords, Users, Trophy, Zap, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function LiveBattleCard({ battle, onClick }: { battle: ArenaBattle, onClick: () => void }) {
  const participantIds = battle.participants;
  const p1 = battle.participantInfo[participantIds[0]];
  const p2 = battle.participantInfo[participantIds[1]];

  return (
    <div 
      onClick={onClick}
      className="bg-slate-950 rounded-[3rem] p-8 text-white relative overflow-hidden group cursor-pointer hover:shadow-[0_0_50px_rgba(220,38,38,0.2)] transition-all border-4 border-slate-900"
    >
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent)] group-hover:opacity-30 transition-opacity animate-pulse" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Live Battle</span>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
            <Users size={12} className="text-slate-400" />
            <span className="text-[10px] font-black tabular-nums">{battle.viewerCount || 0} watching</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Participant 1 */}
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 shadow-2xl" style={{ borderColor: p1?.primaryColor }}>
                <AvatarImage src={p1?.avatarUrl} />
                <AvatarFallback>{p1?.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10 text-[8px] font-black uppercase">
                {p1?.campusAcronym}
              </div>
            </div>
            <p className="font-black text-sm truncate w-full text-center">{p1?.name}</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="p-4 bg-red-600 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.5)] group-hover:scale-110 transition-transform">
              <Swords size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-500 mt-4 uppercase tracking-widest italic">VS</p>
          </div>

          {/* Participant 2 */}
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 shadow-2xl" style={{ borderColor: p2?.primaryColor }}>
                <AvatarImage src={p2?.avatarUrl} />
                <AvatarFallback>{p2?.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10 text-[8px] font-black uppercase">
                {p2?.campusAcronym}
              </div>
            </div>
            <p className="font-black text-sm truncate w-full text-center">{p2?.name}</p>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <h3 className="text-lg font-black italic tracking-tight mb-2">"{battle.title}"</h3>
          <button className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 mx-auto hover:bg-red-500 active:scale-95 transition-all">
            Join the Ring <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
