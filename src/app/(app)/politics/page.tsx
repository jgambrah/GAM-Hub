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

export default function PoliticsPage() {
  const { user, isAdmin, isTokenReady } = useAuth();
  const { firestore } = useFirebase();
  const { viewAsCampus } = useCampusView();

  const activeCampusId = isAdmin ? viewAsCampus?.id : user?.campusId;

  // ✅ QUERY GUARD: Wait for token readiness to prevent permission race
  const manifestosQuery = useMemoFirebase(() => {
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
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
                <Gavel size={32} /> Manifesto Central
            </h1>
            <p className="text-sm text-muted-foreground font-medium italic">Empowering the next generation of leaders</p>
          </div>
          <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 dark:bg-amber-900/20 dark:text-amber-300">
            <ShieldCheck size={14} /> Official SRC Portal
          </div>
        </div>

        {/* Create Manifesto Card (for approved candidates) */}
        <CreateManifestoCard />

        {/* CANDIDATE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[500px] rounded-[3rem]" />)}
            </>
          ) : manifestos && manifestos.length > 0 ? (
            manifestos.map((manifesto) => (
              <ManifestoCard key={manifesto.id} manifesto={manifesto} />
            ))
          ) : (
            <div className="col-span-full text-center py-20 border-2 border-dashed rounded-2xl">
              <h2 className="text-xl font-semibold">No Active Campaigns</h2>
              <p className="text-muted-foreground">
                No candidates have active campaigns for this campus yet. Check back soon!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}