
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import type { Product, UserIntelligence, MarketIntent } from '@/lib/types';
import { computeMarketScore } from '@/lib/market-scoring';
import { enforceMarketDiversity } from '@/lib/market-diversity';
import { useAuth } from './use-auth';
import { parseMarketIntent } from '@/ai/flows/market-intent-parser';
import { expandInterests } from '@/lib/knowledge-graph';

/**
 * useMarketRecommendations Hook
 * ----------------------------
 * The primary discovery engine for the marketplace.
 * Synchronizes with the Unified User Intelligence brain + Knowledge Graph + Trend Scores.
 */
export function useMarketRecommendations(searchQuery: string = '') {
  const { firestore } = useFirebase();
  const { user, isTokenReady } = useAuth();
  
  const [parsedIntent, setParsedIntent] = useState<MarketIntent | null>(null);
  const [expandedInterests, setExpandedInterests] = useState<Record<string, number>>({});
  const [globalTrendScores, setGlobalTrendScores] = useState<Record<string, number>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);

  // 1. LOAD UNIFIED BRAIN 🧠
  const intelRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_intelligence', user.id);
  }, [firestore, user?.id]);
  const { data: unifiedIntelligence, isLoading: isLoadingProfile } = useDoc<UserIntelligence>(intelRef);

  // 🚀 REAL-TIME TREND SYNC
  useEffect(() => {
    if (!firestore) return;
    return onSnapshot(doc(firestore, 'trend_scores', 'current'), (snap) => {
        if (snap.exists()) {
            setGlobalTrendScores(snap.data() as Record<string, number>);
        }
    });
  }, [firestore]);

  // 2. GRAPH EXPANSION: Discover related commerce topics
  useEffect(() => {
    if (!firestore || !unifiedIntelligence?.interests) return;

    const topDirect = Object.entries(unifiedIntelligence.interests)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => id);
    
    expandInterests(firestore, topDirect)
        .then(setExpandedInterests)
        .catch(err => console.warn("Market Graph expansion drifted:", err));
  }, [firestore, unifiedIntelligence?.interests]);

  // 3. RETRIEVAL (Broad Candidate Fetch)
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

  // 4. 🏎️ HYBRID PERSONALIZED RANKING (Knowledge Graph + Trends Enhanced)
  const processed = useMemo(() => {
    if (!candidates) return { ranked: [], trending: [], deals: [], topRated: [] };
    
    const scored = candidates
      .map(product => ({
        product,
        score: computeMarketScore(
            product, 
            unifiedIntelligence || null, 
            globalTrendScores,
            user, 
            searchQuery, 
            parsedIntent,
            expandedInterests
        )
      }))
      .sort((a, b) => b.score - a.score);

    const ranked = enforceMarketDiversity(scored.map(r => r.product));

    const trending = candidates
      .filter(p => (p.trendScore || 0) > 5 || globalTrendScores[p.id] > 5)
      .sort((a, b) => {
          const scoreA = (a.trendScore || 0) + (globalTrendScores[a.id] || 0);
          const scoreB = (b.trendScore || 0) + (globalTrendScores[b.id] || 0);
          return scoreB - scoreA;
      })
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
  }, [candidates, unifiedIntelligence, globalTrendScores, user, searchQuery, parsedIntent, expandedInterests]);

  // 5. AI INTENT PARSING
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
