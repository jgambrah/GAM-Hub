
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
  const [isExplaining, setIsExplaining] = useState(false);

  // 1. LOAD UNIFIED BRAIN
  const intelRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_intelligence', user.id);
  }, [firestore, user?.id]);
  const { data: unifiedIntelligence, isLoading: isLoadingProfile } = useDoc<UserIntelligence>(intelRef);

  // 2. RETRIEVAL
  const candidatesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    return query(
      collection(firestore, 'products'), 
      where('campusId', '==', user.campusId),
      orderBy('createdAt', 'desc'), 
      limit(200)
    );
  }, [firestore, user?.campusId, isTokenReady]);

  const { data: candidates, isLoading: isLoadingCandidates } = useCollection<Product>(candidatesQuery);

  // 3. RANKING, SEGMENTATION & DIVERSITY
  const processed = useMemo(() => {
    if (!candidates) return { ranked: [], trending: [], deals: [], topRated: [] };
    
    // Sort for the primary feed
    const scored = candidates
      .map(product => ({
        product,
        score: computeMarketScore(product, unifiedIntelligence || null, user, searchQuery, parsedIntent)
      }))
      .sort((a, b) => b.score - a.score);

    const ranked = enforceMarketDiversity(scored.map(r => r.product));

    // Specialized Discovery Segments (for isBrowsing mode)
    const trending = candidates
      .filter(p => (p.trendScore || 0) > 5)
      .sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0))
      .slice(0, 10);

    const deals = candidates
      .filter(p => p.averagePrice && p.price < p.averagePrice * 0.9)
      .sort((a, b) => {
          const savingsA = (a.averagePrice || 0) - a.price;
          const savingsB = (b.averagePrice || 0) - b.price;
          return savingsB - savingsA;
      })
      .slice(0, 10);

    const topRated = candidates
      .filter(p => (p.rating || 0) >= 4.5)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 10);

    return { ranked, trending, deals, topRated };
  }, [candidates, unifiedIntelligence, user, searchQuery, parsedIntent]);

  // 4. AI INTENT PARSING (On query change)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
        setParsedIntent(null);
        return;
    }

    const timer = setTimeout(async () => {
        setIsParsing(true);
        try {
            const intent = await parseMarketIntent({ query: searchQuery });
            setParsedIntent(intent);
        } catch (e) {
            console.warn("Liaison AI Parser busy...");
        } finally {
            setIsParsing(false);
        }
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return {
    products: processed.ranked,
    trending: processed.trending,
    deals: processed.deals,
    topRated: processed.topRated,
    isLoading: isLoadingCandidates || isLoadingProfile || isParsing,
    isParsing,
    isExplaining,
    hasProfile: !!unifiedIntelligence,
    intent: parsedIntent
  };
}
