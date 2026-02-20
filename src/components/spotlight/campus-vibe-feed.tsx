
'use client';

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { SpotlightItem } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { FeaturedStudentCard, FeaturedVendorCard, VlogCard, AnnouncementCard } from './campus-spotlight-cards';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';


const SpotlightCard = ({ item }: { item: SpotlightItem }) => {
    switch (item.type) {
        case 'announcement':
            return <AnnouncementCard item={item} />;
        case 'student':
            return <FeaturedStudentCard item={item} />;
        case 'vendor':
            return <FeaturedVendorCard item={item} />;
        case 'vlog':
             // Vlogs have a different aspect ratio, so we wrap them to fit the horizontal scroll
            return <div className="w-[180px] h-full"><VlogCard item={item} /></div>;
        default:
            // Render a generic announcement card as a fallback for events or other types
            if (item.title) {
                 return <AnnouncementCard item={item} />;
            }
            return null;
    }
};

const SkeletonCard = () => (
    <Skeleton className="min-w-[300px] h-48 rounded-[2rem]" />
);


export default function CampusVibeFeed() {
  const { firestore } = useFirebase();

  const vibeQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'spotlight'), 
        orderBy('isOfficial', 'desc'), // Pinned/Official items first
        orderBy('updatedAt', 'desc'), 
        limit(8) // Increased to show more variety
      );
  }, [firestore]);

  const { data: featuredItems, isLoading } = useCollection<SpotlightItem>(vibeQuery);

  if (isLoading) return (
    <section className="py-6">
        <div className="px-4 md:px-6 flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex gap-5 overflow-x-auto px-4 md:px-6 pb-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
        </div>
    </section>
  );

  return (
    <section className="py-6">
      <div className="px-4 md:px-6 flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold font-headline text-foreground tracking-tight">Campus Spotlight 🇬🇭</h3>
        <button className="text-primary text-sm font-bold">See All</button>
      </div>

        <ScrollArea>
            <div className="flex gap-5 px-4 md:px-6 pb-4">
                {featuredItems?.map((item: SpotlightItem) => (
                <SpotlightCard key={item.id} item={item} />
                ))}
            </div>
            <ScrollBar orientation="horizontal" className="h-2.5" />
        </ScrollArea>
    </section>
  );
}
