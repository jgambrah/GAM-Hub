
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import type { Product, MarketProfile } from '@/lib/types';
import { useVibeProfile } from './use-vibe-profile';
import { computeMarketScore } from '@/lib/market-scoring';
import { useAuth } from './use-auth';

/**
 * useMarketRecommendations Hook
 * ----------------------------
 * Implements the Two-Stage Marketplace Ranking pipeline.
 * Stage 1: Bucketed Candidate Retrieval (300 items)
 * Stage 2: Local Multi-Signal Scoring & Personalized Ranking
 */
export function useMarketRecommendations() {
  const { firestore } = useFirebase();
  const { user, isTokenReady } = useAuth();
  const { profile: vibeProfile, isLoaded: isVibeLoaded } = useVibeProfile();
  
  // 1. LOAD USER MARKET PROFILE
  const marketProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_market_profiles', user.id);
  }, [firestore, user?.id]);
  const { data: marketProfile, isLoading: isLoadingProfile } = useDoc<MarketProfile>(marketProfileRef);

  // 2. STAGE 1: CANDIDATE RETRIEVAL (Broad Fetch)
  const candidatesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    
    // Fetch broad set of high-potential candidates from this campus
    return query(
      collection(firestore, 'products'),
      where('campusId', '==', user.campusId),
      orderBy('createdAt', 'desc'),
      limit(300)
    );
  }, [firestore, user?.campusId, isTokenReady]);

  const { data: candidates, isLoading: isLoadingCandidates } = useCollection<Product>(candidatesQuery);

  // 3. STAGE 2: PERSONALIZED RANKING
  const rankedProducts = useMemo(() => {
    if (!candidates) return [];
    if (!marketProfile && !vibeProfile) return candidates;

    return [...candidates]
      .map(product => ({
        product,
        score: computeMarketScore(product, marketProfile, vibeProfile)
      }))
      .sort((a, b) => b.score - a.score)
      .map(r => r.product);
  }, [candidates, marketProfile, vibeProfile]);

  return {
    products: rankedProducts,
    isLoading: isLoadingCandidates || isLoadingProfile || !isVibeLoaded,
    hasProfile: !!marketProfile
  };
}
