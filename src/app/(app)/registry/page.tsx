'use client';

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useCampusView } from '@/hooks/use-campus-view';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { RegistryPost } from '@/lib/types';
import { Landmark, Lock, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CircularViewer } from '@/components/registry/CircularViewer';

/**
 * RegistryHubPage Component
 * 
 * Official hub for University Directives and Circulars.
 * Synchronized with security rules to allow all verified members access.
 */
export default function RegistryHubPage() {
  const { firestore } = useFirebase();
  const { user, isAdmin, isUserLoading, isTokenReady } = useAuth();
  const { viewAsCampus } = useCampusView();

  const activeCampusId = isAdmin ? viewAsCampus?.id : user?.campusId;

  // LIAISON ALIGNMENT: Security rules allow ALL verified members to read circulars.
  // We no longer restrict the UI list to 'management' role only.
  const canRead = !!user && !!activeCampusId;

  // DATA FETCH: Targets the top-level high-trust path
  const registryQuery = useMemoFirebase(() => {
    // Basic handshake: Fires as soon as user context is active
    if (!firestore || !activeCampusId || !user) return null;
    
    return query(
      collection(firestore, 'registry_posts'),
      where('campusId', '==', activeCampusId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeCampusId, user?.id]);

  const { data: posts, isLoading: isLoadingRegistry, error } = useCollection<RegistryPost>(registryQuery);
  
  const isLoading = isUserLoading || isLoadingRegistry;

  if (error) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-[3rem] border-2 border-red-100 dark:border-red-900/50 max-w-md">
            <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-4">Registry Signal Denied</p>
            <p className="text-xs text-slate-500 mb-8">Your identity token may have drifted. Please re-sync with the fortress.</p>
            <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 mx-auto bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-slate-800 transition-all"
            >
                <RefreshCcw size={14} /> Re-sync Identity
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-muted/50 min-h-screen pb-32">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-6 mb-16 animate-in slide-in-from-left-4 duration-700">
          <div className="p-5 bg-blue-900 text-white rounded-[2rem] shadow-2xl shadow-blue-200 dark:shadow-none">
            <Landmark size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">The Registry</h1>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-[0.3em] mt-1 opacity-70">Official University Directives & Circulars</p>
          </div>
        </header>

        <div className="space-y-12">
          {isLoading ? (
            <>
                <Skeleton className="h-[500px] w-full rounded-[3rem]" />
                <Skeleton className="h-[500px] w-full rounded-[3rem]" />
            </>
          ) : posts && posts.length > 0 ? (
            posts.map((post: RegistryPost) => (
              <CircularViewer key={post.id} post={post} />
            ))
          ) : (
            <div className="text-center py-32 bg-white dark:bg-card border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[4rem] animate-in zoom-in duration-500">
                <Landmark className="mx-auto h-20 w-20 text-slate-100 dark:text-slate-800 mb-6" />
                <p className="font-black text-slate-300 uppercase tracking-[0.3em]">The Registry is Silent</p>
                <p className="text-sm text-slate-400 mt-4 italic font-medium max-w-xs mx-auto">
                    Official memos will appear here once released by the Office of the Registrar.
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
