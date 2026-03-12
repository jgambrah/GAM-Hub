
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, Query, DocumentData } from 'firebase/firestore';
import type { Product, UserIntelligence, MarketIntent } from '@/lib/types';
import { computeMarketScore } from '@/lib/market-scoring';
import { enforceMarketDiversity } from '@/lib/market-diversity';
import { useAuth } from './use-auth';
import { parseMarketIntent } from '@/ai/flows/market-intent-parser';

export function useMarketRecommendations(searchQuery: string = '') {
  const { firestore } = useFirebase();
  const { user, isTokenReady } = useAuth();
  
  const [parsedIntent, setParsedIntent] = useState<MarketIntent | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rankedProducts, setRankedProducts] = useState<Product[]>([]);

  // 1. LOAD UNIFIED BRAIN
  const intelRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_intelligence', user.id);
  }, [firestore, user?.id]);
  const { data: unifiedIntelligence, isLoading: isLoadingProfile } = useDoc<UserIntelligence>(intelRef);

  // 2. RETRIEVAL
  const candidatesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    let ref: Query<DocumentData> = collection(firestore, 'products');
    ref = query(ref, where('campusId', '==', user.campusId));
    return query(ref, orderBy('createdAt', 'desc'), limit(200));
  }, [firestore, user?.campusId, isTokenReady]);

  const { data: candidates, isLoading: isLoadingCandidates } = useCollection<Product>(candidatesQuery);

  // 3. RANKING & DIVERSITY
  useEffect(() => {
    if (!candidates) return;
    
    const scored = candidates
      .map(product => ({
        product,
        score: computeMarketScore(product, unifiedIntelligence, user, searchQuery, parsedIntent)
      }))
      .sort((a, b) => b.score - a.score);

    const sortedProducts = scored.map(r => r.product);
    setRankedProducts(enforceMarketDiversity(sortedProducts));
  }, [candidates, unifiedIntelligence, user, searchQuery, parsedIntent]);

  return {
    products: rankedProducts,
    isLoading: isLoadingCandidates || isLoadingProfile || isParsing,
    intent: parsedIntent
  };
}
