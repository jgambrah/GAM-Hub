'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, limit } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Sparkles } from 'lucide-react';
import { CommunityConnectCard } from './student-profile-card';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

export default function MajorMatch() {
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading: isAuthLoading } = useAuth();

  const matchQuery = useMemoFirebase(() => {
    // Don't run query if we don't have a user or their major
    if (!firestore || !currentUser || !currentUser.major) return null;
    
    return query(
      collection(firestore, 'users'),
      where('major', '==', currentUser.major),
      where('visibility', '==', 'public'),
      limit(10)
    );
  }, [firestore, currentUser]);

  const { data: matches, isLoading: isLoadingMatches } = useCollection<User>(matchQuery);
  const isLoading = isAuthLoading || isLoadingMatches;

  const filteredMatches = React.useMemo(() => {
    return matches?.filter(m => m.id !== currentUser?.id) || [];
  }, [matches, currentUser]);

  if (!currentUser || !currentUser.major) {
      // Don't show this component if the user has no major (e.g., they are staff, or a student who hasn't set it)
      return null;
  }

  if (isLoading) {
    return (
        <section className="py-4">
            <Skeleton className="h-8 w-1/2 mb-6" />
            <div className="flex gap-4">
                {[...Array(3)].map((_,i) => <Skeleton key={i} className="min-w-[280px] h-48 rounded-[2rem]" />)}
            </div>
        </section>
    )
  }
  
  if (filteredMatches.length === 0) {
    return null; // Don't show the component if there are no matches
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="text-primary fill-primary" size={20} /> Major-Match
          </h2>
          <p className="text-sm text-muted-foreground italic">Connecting {currentUser.major} students across Ghana</p>
        </div>
        <button className="text-primary text-sm font-bold">See All</button>
      </div>

      <ScrollArea className="-mx-6 px-6">
        <div className="flex gap-4 pb-4">
            {filteredMatches.map((match: User) => (
                <div key={match.id} className="w-[280px] flex-shrink-0">
                    <CommunityConnectCard student={match} currentUser={currentUser!} />
                </div>
            ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
