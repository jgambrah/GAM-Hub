'use client';

import { useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import type { Product, MarketProfile } from '@/lib/types';
import { useVibeProfile } from './use-vibe-profile';
import { computeMarketScore } from '@/lib/market-scoring';
import { enforceMarketDiversity } from '@/lib/market-diversity';
import { useAuth } from './use-auth';

/**
 * useMarketRecommendations Hook
 * ----------------------------
 * The definitive Marketplace Feed Builder.
 * 
 * Pipeline:
 * 1. BUCKETED RETRIEVAL: Pull 300 candidates from current campus.
 * 2. PROFILE MATCHING: Load user's market intent and vibe profiles.
 * 3. MULTI-SIGNAL RANKING: Apply scoring logic (Intent + Vibe + Search + Campus Intel).
 * 4. DIVERSITY FILTER: Final pass to ensure category & vendor balance.
 */
export function useMarketRecommendations(searchQuery: string = '') {
  const { firestore } = useFirebase();
  const { user, isTokenReady } = useAuth();
  const { profile: vibeProfile, isLoaded: isVibeLoaded } = useVibeProfile();
  
  // 1. LOAD USER MARKET PROFILE (Commercial Intent)
  const marketProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_market_profiles', user.id);
  }, [firestore, user?.id]);
  const { data: marketProfile, isLoading: isLoadingProfile } = useDoc<MarketProfile>(marketProfileRef);

  // 2. STAGE 1: CANDIDATE RETRIEVAL (Bucketed)
  const candidatesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    
    // Fetch broad set of high-potential candidates for the current campus
    return query(
      collection(firestore, 'products'),
      where('campusId', '==', user.campusId),
      orderBy('createdAt', 'desc'),
      limit(300)
    );
  }, [firestore, user?.campusId, isTokenReady]);

  const { data: candidates, isLoading: isLoadingCandidates } = useCollection<Product>(candidatesQuery);

  // 3. STAGE 2 & 3: PERSONALIZED RANKING & DIVERSITY (Local Pass)
  const rankedProducts = useMemo(() => {
    if (!candidates) return [];
    
    // A. Local Multi-Signal Scoring (Stage 2)
    // We include Search Query and the full User object for campus intelligence
    const scored = [...candidates]
      .map(product => ({
        product,
        score: computeMarketScore(product, marketProfile || null, vibeProfile, user, searchQuery)
      }))
      .sort((a, b) => b.score - a.score);

    // If searching, we filter more strictly by score or presence of search term
    let filtered = scored;
    if (searchQuery.trim()) {
        filtered = scored.filter(r => r.score > 5); // Minimum relevance threshold for search
    }

    const finalRanked = filtered.map(r => r.product);

    // B. Diversity Protocol (Stage 3: Balance Vendors and Categories)
    return enforceMarketDiversity(finalRanked);
  }, [candidates, marketProfile, vibeProfile, user, searchQuery]);

  return {
    products: rankedProducts,
    isLoading: isLoadingCandidates || isLoadingProfile || !isVibeLoaded,
    hasProfile: !!marketProfile || !!vibeProfile
  };
}
