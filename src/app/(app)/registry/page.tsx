'use client';

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useCampusView } from '@/hooks/use-campus-view';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { RegistryPost } from '@/lib/types';
import { Landmark, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CircularCard } from '@/components/registry/CircularCard';

export default function RegistryHubPage() {
  const { firestore } = useFirebase();
  const { user, isAdmin, isUserLoading, isTokenReady } = useAuth();
  const { viewAsCampus } = useCampusView();

  const activeCampusId = isAdmin ? viewAsCampus?.id : user?.campusId;

  // LIAISON RESTRICTION: Management sees everything, Students/Staff see items scoped to them or 'all'
  // Actually, per recent directive, registry_posts is management-only. 
  // Let's refine the query to match the security rules and user role.
  const isAuthorized = React.useMemo(() => {
    if (!user) return false;
    return user.role === 'management' || isAdmin;
  }, [user, isAdmin]);

  // DATA FETCH: Guarded by isAuthorized and isTokenReady
  const registryQuery = useMemoFirebase(() => {
    if (!firestore || !activeCampusId || !isTokenReady || !isAuthorized) return null;
    
    // Management/Admin can see all circulars for this campus
    return query(
      collection(firestore, 'registry_posts'),
      where('campusId', '==', activeCampusId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeCampusId, isTokenReady, isAuthorized]);

  const { data: posts, isLoading: isLoadingRegistry } = useCollection<RegistryPost>(registryQuery);
  
  const isLoading = isUserLoading || isLoadingRegistry;

  if (!isAuthorized && !isLoading) {
    return (
      <div className="p-4 md:p-8 bg-muted/50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-10 bg-white dark:bg-card rounded-[3.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Lock className="text-amber-600" size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Registry Restricted</h1>
            <p className="text-sm text-slate-500 mt-4 leading-relaxed font-medium">
              Official University Directives are only accessible to authorized management personnel. Please contact your campus administrator for official notices.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-muted/50 min-h-screen pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-6 mb-16">
          <div className="p-5 bg-blue-900 text-white rounded-[2rem] shadow-2xl">
            <Landmark size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">The Registry</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-70">Official University Directives & Circulars</p>
          </div>
        </div>

        <div className="space-y-10">
          {isLoading ? (
            <>
                <Skeleton className="h-64 w-full rounded-[3rem]" />
                <Skeleton className="h-64 w-full rounded-[3rem]" />
            </>
          ) : posts && posts.length > 0 ? (
            posts.map((post: RegistryPost) => (
              <CircularCard key={post.id} post={post} />
            ))
          ) : (
            <div className="text-center py-32 bg-white dark:bg-card border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[4rem]">
                <Landmark className="mx-auto h-20 w-20 text-slate-100 dark:text-slate-800 mb-6" />
                <p className="font-black text-slate-300 uppercase tracking-[0.3em]">No official directives found</p>
                <p className="text-sm text-slate-400 mt-4 italic font-medium">The Registry is currently quiet. Directives will appear here as they are released.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
