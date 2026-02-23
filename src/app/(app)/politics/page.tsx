
'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Manifesto } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Gavel, ShieldCheck } from 'lucide-react';
import ManifestoCard from '@/components/politics/manifesto-card';
import { useCampusView } from '@/hooks/use-campus-view';
import CreateManifestoCard from '@/components/politics/CreateManifestoCard';

/**
 * PoliticsPage Component
 * 
 * Central hub for campus manifestos and elections.
 * Correctly segregates political content by campus ID for all user roles (Student/Staff/Admin).
 */
export default function PoliticsPage() {
  const { user, isAdmin, isTokenReady } = useAuth();
  const { firestore } = useFirebase();
  const { viewAsCampus } = useCampusView();

  // The active context: Staff/Students use their profile campus, Liaison uses the global switcher
  const activeCampusId = isAdmin ? viewAsCampus?.id : user?.campusId;

  // ✅ POLITICS COLLECTION HANDSHAKE: Query the root manifestos path
  const manifestosQuery = useMemoFirebase(() => {
    // Guard against permission races by waiting for context and token readiness
    if (!firestore || !activeCampusId || !isTokenReady) return null;
    
    return query(
      collection(firestore, 'manifestos'),
      where('campusId', '==', activeCampusId),
      where('status', '==', 'active'),
      orderBy('endorsements', 'desc')
    );
  }, [firestore, activeCampusId, isTokenReady]);

  const { data: manifestos, isLoading } = useCollection<Manifesto>(manifestosQuery);

  return (
    <div className="bg-background min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* HEADER: COMMAND SIGNAL */}
        <div className="flex justify-between items-end mb-10 px-2">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight italic uppercase">
                <Gavel size={32} /> Manifesto Central
            </h1>
            <p className="text-sm text-muted-foreground font-medium italic">Vibrating the future of campus leadership</p>
          </div>
          <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 dark:bg-amber-900/20 dark:text-amber-300 shadow-sm border border-amber-200/50">
            <ShieldCheck size={14} /> Official SRC Portal
          </div>
        </div>

        {/* Action Center: Visibility gated by Candidate Status */}
        <CreateManifestoCard />

        {/* THE MANIFESTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[500px] rounded-[3rem]" />)}
            </>
          ) : manifestos && manifestos.length > 0 ? (
            manifestos.map((manifesto) => (
              <ManifestoCard key={manifesto.id} manifesto={manifesto} />
            ))
          ) : (
            <div className="col-span-full text-center py-32 border-4 border-dashed rounded-[4rem] bg-muted/10 border-muted-foreground/10">
              <Gavel className="mx-auto h-20 w-20 text-muted-foreground/20 mb-6" />
              <h2 className="text-xl font-black text-muted-foreground uppercase tracking-[0.3em]">The Poll is Quiet</h2>
              <p className="text-sm text-muted-foreground mt-4 italic font-medium max-w-sm mx-auto">
                No active campaigns found for this Yard. Candidates will appear here once vetted by the SRC.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
