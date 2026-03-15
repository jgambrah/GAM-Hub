
'use client';

/**
 * CampusWarCard Component
 * -----------------------
 * A prestigious national stage card for University vs University showdowns.
 * Features a massive Energy Bar visualization and real-time attendance stats.
 */

import React from 'react';
import type { CampusWar } from '@/lib/types';
import { Globe, Users, Trophy, Zap, ChevronRight, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CampusWarCard({ war, onClick }: { war: CampusWar, onClick: () => void }) {
  const totalVotes = (war.votesA || 0) + (war.votesB || 0);
  const p1Pct = totalVotes > 0 ? ((war.votesA || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  const campusA = war.campusAInfo;
  const campusB = war.campusBInfo;

  return (
    <div 
      onClick={onClick}
      className="bg-slate-950 rounded-[3.5rem] p-10 text-white relative overflow-hidden group cursor-pointer hover:shadow-[0_0_100px_rgba(79,70,229,0.2)] transition-all border-4 border-slate-900 border-t-indigo-600"
    >
      {/* Background Graphic */}
      <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
        <Globe size={300} />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
            <span className="text-xs font-black uppercase tracking-[0.4em] text-red-500">National Yard Conflict</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
            <Users size={16} className="text-indigo-400" />
            <span className="text-xs font-black tabular-nums">{war.viewerCount || 0} Citizens Engaged</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-10 mb-12">
          {/* CAMPUS A */}
          <div className="text-center md:text-left">
            <h3 className="text-5xl font-black italic tracking-tighter mb-2" style={{ color: campusA?.primaryColor || '#fff' }}>
              {campusA?.acronym}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">{campusA?.name}</p>
            <p className="text-3xl font-black mt-4 tabular-nums">{(war.votesA || 0).toLocaleString()}</p>
          </div>

          {/* VS HUD */}
          <div className="flex flex-col items-center">
            <div className="p-6 bg-indigo-600 rounded-full shadow-[0_0_50px_rgba(79,70,229,0.5)] group-hover:scale-110 transition-transform">
              <Swords size={48} />
            </div>
            <p className="text-[10px] font-black text-slate-500 mt-6 uppercase tracking-widest italic">Inter-Uni War</p>
          </div>

          {/* CAMPUS B */}
          <div className="text-center md:text-right">
            <h3 className="text-5xl font-black italic tracking-tighter mb-2" style={{ color: campusB?.primaryColor || '#fff' }}>
              {campusB?.acronym}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">{campusB?.name}</p>
            <p className="text-3xl font-black mt-4 tabular-nums">{(war.votesB || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* ENERGY BAR HUD */}
        <div className="h-10 bg-white/5 rounded-full overflow-hidden flex p-1.5 border border-white/10 mb-12 shadow-inner relative">
            <div 
                className="h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                style={{ width: `${p1Pct}%`, backgroundColor: campusA?.primaryColor || '#3b82f6' }} 
            />
            <div 
                className="h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(245,158,11,0.3)]" 
                style={{ width: `${p2Pct}%`, backgroundColor: campusB?.primaryColor || '#f59e0b' }} 
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/30 -translate-x-1/2 z-20" />
        </div>

        <div className="text-center space-y-6">
          <h2 className="text-2xl font-black italic tracking-tight">"{war.title}"</h2>
          <button className="bg-indigo-600 text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl flex items-center gap-3 mx-auto hover:bg-indigo-500 active:scale-95 transition-all group-hover:scale-105">
            Defend Your Yard <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
