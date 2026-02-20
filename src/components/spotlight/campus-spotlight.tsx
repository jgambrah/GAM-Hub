
'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Star, ShoppingBag, Trophy, Flame, Play, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '../ui/skeleton';
import type { SpotlightItem } from '@/lib/types';

export default function CampusSpotlight() {
  const { user } = useAuth();
  const { firestore } = useFirebase();

  // 1. DYNAMIC QUERY: Fetch top performers for THIS campus and National
  const spotlightQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'spotlight'),
      orderBy('updatedAt', 'desc'),
      limit(12) // Fetch a few extra to account for client-side filtering
    );
  }, [firestore]);

  const { data: winners, isLoading } = useCollection<SpotlightItem>(spotlightQuery);

  if (isLoading) return (
    <div className="flex gap-4 overflow-x-auto px-6 pb-4 no-scrollbar">
        {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="min-w-[280px] h-48 rounded-[3rem] bg-slate-50" />
        ))}
    </div>
  );

  // THE BULLETPROOF LIAISON FILTER LOGIC
  const filteredWinners = winners?.filter(w => {
    // 1. If it's a National Spotlight, always show it
    if (w.campusId === 'all' || w.authorCampus === 'GH') return true;

    // 2. If it matches the user's specific campus (case-insensitive)
    const isMatch = 
      w.campusId?.toLowerCase() === user?.campusId?.toLowerCase() ||
      w.authorCampus?.toLowerCase() === user?.campusAcronym?.toLowerCase();

    return isMatch;
  }).slice(0, 6);

  if (!filteredWinners || filteredWinners.length === 0) {
    return (
      <div className="mx-4 p-12 bg-white border-2 border-dashed border-slate-100 rounded-[3rem] text-center flex flex-col items-center">
        <Sparkles className="text-slate-200 mb-4" size={48} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">The Yard is Warming Up...</p>
        <p className="text-[10px] text-slate-300 mt-2 italic">Check back later for today's campus stars!</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="px-6 flex justify-between items-center">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Trophy className="text-amber-500" size={20} /> Winners of the Yard
        </h2>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Spotlight</span>
      </div>

      <div className="flex gap-4 overflow-x-auto px-6 pb-4 no-scrollbar">
        {filteredWinners.map((winner) => (
          <SpotlightCard key={winner.id} winner={winner} />
        ))}
      </div>
    </section>
  );
}

function SpotlightCard({ winner }: { winner: SpotlightItem }) {
  const isVendor = winner.type === 'vendor';
  const isVlog = winner.type === 'vlog';
  const data: any = winner.data;

  return (
    <div className={`min-w-[280px] p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden transition-all active:scale-95 group cursor-pointer`}
      style={{ 
        backgroundColor: winner.vibeColor || '#0f172a',
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)'
      }}>
      
      {/* Background Icon Watermark */}
      <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
        {isVendor ? <ShoppingBag size={120} /> : <Star size={120} />}
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <span className="bg-white/20 backdrop-blur-md text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border border-white/10">
            {winner.type === 'vendor' ? 'Top Merchant' : winner.type === 'student' ? 'Campus Star' : winner.type === 'vlog' ? 'Viral Vibe' : 'Special Notice'}
          </span>
          <div className="p-2 bg-white/10 rounded-xl border border-white/5">
            {isVlog ? <Play size={16} fill="currentColor" /> : <Trophy size={16} />}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 overflow-hidden shadow-inner relative flex-shrink-0">
             <img 
                src={winner.image || data?.avatarUrl || data?.imageUrl || `https://picsum.photos/seed/${winner.id}/200`} 
                className="w-full h-full object-cover" 
                alt="Profile" 
             />
          </div>
          <div className="min-w-0">
             <h4 className="font-black text-lg truncate leading-tight">{winner.title || data?.name || data?.businessName}</h4>
             <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest truncate">
                {winner.authorCampus || 'National'}
             </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs font-black">{winner.score || 0} Vibe Points</span>
          </div>
          <div className="p-2 bg-white text-slate-900 rounded-xl hover:bg-slate-100 transition-colors shadow-lg">
            <ArrowRight size={16} />
          </div>
        </div>
      </div>
    </div>
  );
}
