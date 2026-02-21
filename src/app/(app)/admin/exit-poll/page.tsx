'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Manifesto } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Award, Users, BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * ExitPollDashboard Component
 * 
 * High-performance command center for the Liaison to track national endorsement trends.
 * Features a dark-themed "Elite" design suitable for sensitive political intelligence.
 */
export default function ExitPollDashboard() {
  const { firestore } = useFirebase();

  // 1. NATIONAL QUERY: Pull all manifestos across all campuses, ranked by endorsements
  const manifestosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'manifestos'), 
      orderBy('endorsements', 'desc')
    );
  }, [firestore]);

  const { data: rankings, isLoading } = useCollection<Manifesto>(manifestosQuery);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER: COMMAND CENTER BRANDING */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="font-headline text-4xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase">National Exit Poll</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-[0.2em] text-[10px]">Real-time Global Candidate Intelligence</p>
        </div>
        <div className="p-4 bg-amber-500 rounded-3xl text-slate-950 shadow-xl shadow-amber-500/20">
          <TrendingUp size={28} />
        </div>
      </div>
      
      {/* THE DATA FORTRESS */}
      <div className="bg-slate-950 p-6 md:p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden border-t-8 border-amber-500">
        {/* Background Watermark */}
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <BarChart3 size={250} className="text-white" />
        </div>

        <div className="relative z-10">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-[2.5rem] bg-slate-900" />
              ))}
            </div>
          ) : rankings && rankings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rankings.map((candidate, index) => (
                <div 
                  key={candidate.id} 
                  className="group bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-amber-500/50 transition-all relative overflow-hidden h-full flex flex-col justify-between"
                >
                  {/* Performance Watermark */}
                  <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
                    <Award size={120} />
                  </div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <span className="text-5xl font-black text-slate-800 italic group-hover:text-amber-500/20 transition-colors">
                        #{index + 1}
                      </span>
                      <span className="bg-blue-500/10 text-blue-400 text-[9px] font-black px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">
                        {candidate.campusAcronym || candidate.campusId.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="mb-8">
                      <h3 className="text-2xl font-black text-white leading-tight mb-1 group-hover:text-amber-500 transition-colors">
                        {candidate.candidateName}
                      </h3>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        {candidate.position}
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative z-10 pt-6 border-t border-slate-800 flex items-end gap-3">
                    <span className="text-5xl font-black text-amber-500 tabular-nums tracking-tighter">
                      {(candidate.endorsements || 0).toLocaleString()}
                    </span>
                    <div className="mb-1">
                      <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] leading-none">Digital</p>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-none mt-0.5">Endorsements</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-slate-900/50 border-4 border-dashed border-slate-800 rounded-[4rem]">
              <Users className="mx-auto h-20 w-20 text-slate-800 mb-6" />
              <p className="font-black text-slate-500 uppercase tracking-[0.3em]">The Poll is Quiet</p>
              <p className="text-xs text-slate-600 mt-4 italic font-medium">No candidates have published manifestos to the Yard yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 bg-slate-100 dark:bg-muted/20 rounded-[2.5rem] border border-slate-200 dark:border-border text-center">
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">
           Official GAM Hub Liaison Data • Encryption Level: FORTRESS
         </p>
      </div>
    </div>
  );
}
