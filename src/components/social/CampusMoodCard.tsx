'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { analyzeCampusMood, type CampusMoodOutput } from '@/ai/flows/campus-mood-flow';
import { Sparkles, BrainCircuit, Loader2, Info, Zap, Flame, GraduationCap, PartyPopper, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CampusMoodCard Component
 * 
 * Part of the Trend Detection Engine.
 * Fetches real-time trend scores and uses AI to interpret the campus "Vibe".
 * Includes a 1-hour session cache to prevent redundant AI calls.
 */
export default function CampusMoodCard() {
  const { firestore } = useFirebase();
  const [mood, setMood] = useState<CampusMoodOutput | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Listen to Real-Time Trend Aggregator
  const trendRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'trend_scores', 'current');
  }, [firestore]);

  const { data: trendData, isLoading: isTrendLoading } = useDoc<any>(trendRef);

  useEffect(() => {
    if (!trendData || isTrendLoading) return;

    const performAnalysis = async () => {
      // 🏗️ CACHE CHECK: Don't call AI if we already have a mood for this data session
      const cachedMood = sessionStorage.getItem('campus_mood_data');
      const cacheTimestamp = sessionStorage.getItem('campus_mood_time');
      
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      if (cachedMood && cacheTimestamp && (now - parseInt(cacheTimestamp) < oneHour)) {
        setMood(JSON.parse(cachedMood));
        return;
      }

      setLoading(true);
      try {
        // Extract top 15 trending tags/entities for AI context
        const trends = Object.entries(trendData)
          .filter(([k]) => !k.startsWith('_'))
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 15)
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

        if (Object.keys(trends).length === 0) {
            setLoading(false);
            return;
        }

        const result = await analyzeCampusMood({ trends });
        setMood(result);
        
        // Update Cache
        sessionStorage.setItem('campus_mood_data', JSON.stringify(result));
        sessionStorage.setItem('campus_mood_time', now.toString());
      } catch (err) {
        console.error("Mood Analysis Drifted:", err);
      } finally {
        setLoading(false);
      }
    };

    performAnalysis();
  }, [trendData, isTrendLoading]);

  if (isTrendLoading || (loading && !mood)) {
    return (
      <div className="mx-4 mb-8 h-32 bg-muted/50 animate-pulse rounded-[2.5rem] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary/30" />
      </div>
    );
  }

  if (!mood) return null;

  const VibeIcon = {
    calm: Info,
    energetic: Zap,
    stressed: GraduationCap,
    celebratory: PartyPopper,
    commercial: ShoppingBag
  }[mood.visualVibe] || Sparkles;

  const VibeColor = {
    calm: 'bg-blue-500',
    energetic: 'bg-orange-500',
    stressed: 'bg-indigo-600',
    celebratory: 'bg-pink-500',
    commercial: 'bg-emerald-500'
  }[mood.visualVibe] || 'bg-primary';

  return (
    <div className="mx-4 mb-10 animate-in zoom-in duration-700">
      <div className={cn(
        "p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group transition-all",
        VibeColor
      )}>
        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
          <VibeIcon size={150} />
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
                <BrainCircuit size={24} className="animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Campus Pulse Interpretation</p>
                <h2 className="text-2xl font-black italic tracking-tighter uppercase">{mood.moodTitle}</h2>
              </div>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
               <Sparkles size={14} className="text-amber-300" />
               <span className="text-[10px] font-black uppercase tracking-widest">AI Status</span>
            </div>
          </div>

          <div className="space-y-4 max-w-2xl">
            <p className="text-lg font-bold leading-tight text-white/90">
              "{mood.description}"
            </p>
            
            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 flex items-start gap-3">
               <div className="p-2 bg-amber-500 rounded-xl shadow-lg"><Info size={14} className="text-slate-900" /></div>
               <p className="text-xs font-medium italic text-white/80">
                 <b>Liaison Advice:</b> {mood.advice}
               </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
             <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white/20 bg-white/10 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
                <div className="ml-4 flex items-center text-[9px] font-black uppercase tracking-widest text-white/60">
                    Students are aligned
                </div>
             </div>
             <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/40">
               Liaison Mood Engine Active
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
