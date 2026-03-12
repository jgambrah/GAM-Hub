
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, CollectionReference, Query, DocumentData } from 'firebase/firestore';
import type { Product, MarketProfile, MarketIntent } from '@/lib/types';
import { useVibeProfile } from './use-vibe-profile';
import { computeMarketScore } from '@/lib/market-scoring';
import { enforceMarketDiversity } from '@/lib/market-diversity';
import { useAuth } from './use-auth';
import { parseMarketIntent } from '@/ai/flows/market-intent-parser';

/**
 * useMarketRecommendations Hook
 * ----------------------------
 * The definitive Marketplace Feed Builder.
 * 
 * Pipeline:
 * 1. AI INTENT PARSING: Natural language to structured query.
 * 2. BUCKETED RETRIEVAL: Pull candidates from current campus using parsed intent filters.
 * 3. MULTI-SIGNAL RANKING: Intent + Vibe + Trust + Deal + Semantic Tags.
 * 4. DIVERSITY FILTER: Vendor & Category balance.
 */
export function useMarketRecommendations(searchQuery: string = '') {
  const { firestore } = useFirebase();
  const { user, isTokenReady } = useAuth();
  const { profile: vibeProfile, isLoaded: isVibeLoaded } = useVibeProfile();
  
  const [parsedIntent, setParsedIntent] = useState<MarketIntent | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // 🧠 STAGE 0: AI INTENT PARSING (The Shopping Assistant)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.startsWith('#')) {
        setParsedIntent(null);
        return;
    }

    // Only invoke AI for complex sentences (more than 2 words)
    const isComplex = searchQuery.trim().split(/\s+/).length > 2;
    if (!isComplex) {
        setParsedIntent(null);
        return;
    }

    const timer = setTimeout(async () => {
        setIsParsing(true);
        try {
            const intent = await parseMarketIntent({ query: searchQuery });
            setParsedIntent(intent);
        } catch (e) {
            console.error("Liaison AI: Intent parsing failed", e);
        } finally {
            setIsParsing(false);
        }
    }, 600); // Debounce to save tokens and prevent jitter

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 1. LOAD USER MARKET PROFILE
  const marketProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_market_profiles', user.id);
  }, [firestore, user?.id]);
  const { data: marketProfile, isLoading: isLoadingProfile } = useDoc<MarketProfile>(marketProfileRef);

  // 2. STAGE 1: INTENT-AWARE CANDIDATE RETRIEVAL (Step 2)
  const candidatesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    
    let ref: Query<DocumentData> = collection(firestore, 'products');

    // Filter by Campus (Mandatory)
    ref = query(ref, where('campusId', '==', user.campusId));

    // Step 2: Use parsed intent to narrow retrieval
    if (parsedIntent?.category) {
        // Broad Category Filter
        ref = query(ref, where('category', '==', parsedIntent.category));
    }

    // We order by creation to get fresh vibes, limiting to 300 candidates for local ranking
    return query(ref, orderBy('createdAt', 'desc'), limit(300));
  }, [firestore, user?.campusId, isTokenReady, parsedIntent?.category]);

  const { data: candidates, isLoading: isLoadingCandidates } = useCollection<Product>(candidatesQuery);

  // 3. STAGE 2 & 3: PERSONALIZED RANKING & DIVERSITY (Step 3)
  const rankedProducts = useMemo(() => {
    if (!candidates) return [];
    
    const scored = [...candidates]
      .map(product => ({
        product,
        score: computeMarketScore(product, marketProfile || null, vibeProfile, user, searchQuery, parsedIntent)
      }))
      .sort((a, b) => b.score - a.score);

    // If searching, only show relevant matches
    let finalRankedPool = scored;
    if (searchQuery.trim()) {
        // High confidence threshold for search results
        finalRankedPool = scored.filter(r => r.score > 5); 
    }

    const sortedProducts = finalRankedPool.map(r => r.product);
    return enforceMarketDiversity(sortedProducts);
  }, [candidates, marketProfile, vibeProfile, user, searchQuery, parsedIntent]);

  return {
    products: rankedProducts,
    isLoading: isLoadingCandidates || isLoadingProfile || !isVibeLoaded,
    isParsing,
    hasProfile: !!marketProfile || !!vibeProfile,
    intent: parsedIntent
  };
}
