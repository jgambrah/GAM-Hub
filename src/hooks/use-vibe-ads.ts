'use client';

import { useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { AdCampaign } from '@/lib/types';
import { useAuth } from './use-auth';
import { useVibeProfile } from './use-vibe-profile';

/**
 * useVibeAds Hook
 * ----------------
 * Intelligence center for sponsored vibrations. 
 * Interleaves ads into the organic feed every N posts.
 */

// Tunable: How often should an ad appear in the scroll?
export const AD_INTERVAL = 5;

export function useVibeAds() {
  const { firestore } = useFirebase();
  const { user, isTokenReady } = useAuth();
  const { getPersonalScore } = useVibeProfile();

  // 1. Fetch active campaigns targeting THIS campus or ALL campuses
  const adsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    
    return query(
      collection(firestore, 'ad_campaigns'),
      where('status', '==', 'active'),
      where('campusIds', 'array-contains-any', [user.campusId, 'all']),
      orderBy('priority', 'desc'),
      limit(20)
    );
  }, [firestore, user?.campusId, isTokenReady]);

  const { data: rawAds, isLoading } = useCollection<AdCampaign>(adsQuery);

  // 2. Rank and Interleave Logic
  const ads = useMemo(() => {
    if (!rawAds) return [];
    
    // Scoring ads using the same profile affinity used for organic content
    // This makes ads feel natively relevant.
    return [...rawAds].sort((a, b) => {
      const scoreA = getPersonalScore({ tags: a.targetTags } as any);
      const scoreB = getPersonalScore({ tags: b.targetTags } as any);
      
      // Secondary sort by advertiser priority
      if (scoreA === scoreB) return b.priority - a.priority;
      return scoreB - scoreA;
    });
  }, [rawAds, getPersonalScore]);

  /**
   * interleaveAds
   * -------------
   * Takes organic posts and inserts ads at fixed intervals.
   */
  const interleaveAds = (organicPosts: any[]) => {
    if (!ads.length || !organicPosts.length) return organicPosts;

    const combined = [];
    let adIdx = 0;

    for (let i = 0; i < organicPosts.length; i++) {
      combined.push(organicPosts[i]);
      
      // Inject ad every AD_INTERVAL posts
      if ((i + 1) % AD_INTERVAL === 0 && ads[adIdx]) {
        combined.push({ 
          ...ads[adIdx], 
          isAd: true, 
          // Generate a virtual content field for the similarity engine if needed
          content: ads[adIdx].headline 
        });
        adIdx = (adIdx + 1) % ads.length; // Loop ads if organic > ads*N
      }
    }

    return combined;
  };

  return { ads, isLoading, interleaveAds };
}
