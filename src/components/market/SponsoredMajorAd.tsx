'use client';

import React, { useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ExternalLink, Sparkles, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product, Group } from '@/lib/types';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function SponsoredMajorAd({ userMajor }: { userMajor: string | undefined }) {
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();

  // 1. Fetch groups current user belongs to
  const userGroupsQuery = useMemoFirebase(() => {
    // LIAISON FIX: Vendors don't need to see targeted ads for themselves based on group membership.
    // This stops the permission error when Vendors visit the products page.
    if (!firestore || !user || user.role === 'vendor') return null;
    return query(collection(firestore, 'groups'), where('members', 'array-contains', user.id));
  }, [firestore, user]);
  const { data: userGroups } = useCollection<Group>(userGroupsQuery);

  const groupIds = useMemo(() => userGroups?.map(g => g.id) || [], [userGroups]);

  // 2. Fetch products sponsored for THIS specific major, "All Majors", or USER'S GROUPS
  const adQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    // We fetch active ads. The filtering for major/group is done client-side 
    // to avoid complex composite index requirements for dynamic group arrays
    return query(
      collection(firestore, 'products'),
      where('isSponsored', '==', true),
      where('adStatus', '==', 'active'),
      limit(10)
    );
  }, [firestore]);

  const { data: ads, isLoading } = useCollection<Product>(adQuery);

  // 3. Client-side filter for precise targeting
  const activeAd = useMemo(() => {
    if (!ads || !user) return null;
    return ads.find(ad => {
        // Match Major
        if (ad.targetType === 'major' && (ad.targetValue === userMajor || ad.targetValue === 'All Majors')) return true;
        // Match Group
        if (ad.targetType === 'group' && groupIds.includes(ad.targetValue || '')) return true;
        // Fallback for old ads
        if (!ad.targetType && (ad.sponsoredMajor === userMajor || ad.sponsoredMajor === 'All Majors')) return true;
        return false;
    });
  }, [ads, user, userMajor, groupIds]);

  const handleAdClick = async () => {
    if (!firebaseApp || !activeAd) return;
    
    const functions = getFunctions(firebaseApp);
    const trackClick = httpsCallable(functions, 'trackAdClick');
    
    try {
      trackClick({ 
        productId: activeAd.id, 
        vendorId: activeAd.vendorId 
      }).catch(err => console.error("Ad Click Engine Error:", err));

      router.push(`/products/${activeAd.id}`);
    } catch (err) {
      console.error("Click Tracking Failed:", err);
      router.push(`/products/${activeAd.id}`);
    }
  };

  if (isLoading) {
      return (
          <div className="mx-4 my-6">
              <Skeleton className="h-40 w-full rounded-[2.5rem]" />
          </div>
      )
  }

  if (!activeAd) {
    return null;
  }

  const headline = activeAd.adHeadline || `Special Offer for ${userMajor || 'The Yard'}`;
  const slogan = activeAd.adSlogan || activeAd.description;
  const isGroupAd = activeAd.targetType === 'group';

  return (
    <div className="mx-4 my-6 bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 rounded-[2.5rem] p-1 shadow-2xl shadow-blue-200/50">
      <div className="bg-background rounded-[2.3rem] p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        {/* Ad Image */}
        <div className="w-full md:w-32 h-32 rounded-3xl bg-muted overflow-hidden relative shadow-lg">
          <Image src={activeAd.imageUrl} fill className="object-cover" alt={activeAd.name} data-ai-hint={activeAd.imageHint} />
          <div className="absolute top-2 left-2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded-md flex items-center gap-1 shadow-lg">
            <Sparkles size={8} fill="currentColor" /> SPONSORED
          </div>
        </div>

        {/* Ad Copy */}
        <div className="flex-1 text-center md:text-left relative z-10">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            {isGroupAd ? <Users size={12} className="text-indigo-600" /> : <Zap size={12} className="text-blue-600 fill-blue-600" />}
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              {isGroupAd ? 'Community Exclusive' : `Exclusive for ${activeAd.targetValue === 'All Majors' ? 'The Yard' : activeAd.targetValue}`}
            </p>
          </div>
          <h3 className="text-2xl font-black text-foreground leading-tight tracking-tighter">
            {headline}
          </h3>
          <p className="text-sm font-bold text-muted-foreground mt-2 line-clamp-2 italic">
            "{slogan}"
          </p>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleAdClick}
          className="w-full md:w-auto px-10 py-6 h-auto bg-slate-900 text-white rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
        >
          Grab This Deal <ExternalLink size={16} />
        </Button>

        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-50/5 rounded-full blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}