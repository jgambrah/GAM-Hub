
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, Query, DocumentData } from 'firebase/firestore';
import type { Product, MarketProfile, MarketIntent } from '@/lib/types';
import { useVibeProfile } from './use-vibe-profile';
import { computeMarketScore, computeVendorScore, computeDealBoost } from '@/lib/market-scoring';
import { enforceMarketDiversity } from '@/lib/market-diversity';
import { useAuth } from './use-auth';
import { parseMarketIntent } from '@/ai/flows/market-intent-parser';
import { generateRecommendationReason } from '@/ai/flows/explain-recommendation';

/**
 * useMarketRecommendations Hook (The AI Shopping Assistant API)
 * -----------------------------------------------------------
 * The definitive Marketplace Feed Builder.
 */
export function useMarketRecommendations(searchQuery: string = '') {
  const { firestore } = useFirebase();
  const { user, isTokenReady } = useAuth();
  const { profile: vibeProfile, isLoaded: isVibeLoaded } = useVibeProfile();
  
  const [parsedIntent, setParsedIntent] = useState<MarketIntent | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rankedProducts, setRankedProducts] = useState<Product[]>([]);
  const [isExplaining, setIsExplaining] = useState(false);

  // 🧠 STAGE 0: AI INTENT PARSING
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.startsWith('#')) {
        setParsedIntent(null);
        return;
    }

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
    }, 600);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 1. LOAD USER MARKET PROFILE
  const marketProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_market_profiles', user.id);
  }, [firestore, user?.id]);
  const { data: marketProfile, isLoading: isLoadingProfile } = useDoc<MarketProfile>(marketProfileRef);

  // 2. STAGE 1: RETRIEVAL
  const candidatesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    
    let ref: Query<DocumentData> = collection(firestore, 'products');
    ref = query(ref, where('campusId', '==', user.campusId));

    if (parsedIntent?.category) {
        ref = query(ref, where('category', '==', parsedIntent.category));
    }

    return query(ref, orderBy('createdAt', 'desc'), limit(300));
  }, [firestore, user?.campusId, isTokenReady, parsedIntent?.category]);

  const { data: candidates, isLoading: isLoadingCandidates } = useCollection<Product>(candidatesQuery);

  // 3. STAGE 2, 3 & 4: RANKING, DIVERSITY, AND EXPLANATION
  useEffect(() => {
    if (!candidates) return;
    
    const scored = [...candidates]
      .map(product => ({
        product,
        score: computeMarketScore(product, marketProfile || null, vibeProfile, user, searchQuery, parsedIntent)
      }))
      .sort((a, b) => b.score - a.score);

    let finalRankedPool = scored;
    if (searchQuery.trim()) {
        finalRankedPool = scored.filter(r => r.score > 5); 
    }

    const sortedProducts = finalRankedPool.map(r => r.product);
    const diverse = enforceMarketDiversity(sortedProducts);
    
    // 🧠 STAGE 4: AI RESULT EXPLANATION (Only for Top 3)
    const runExplainer = async () => {
        if (searchQuery.trim() && diverse.length > 0 && !isParsing) {
            setIsExplaining(true);
            try {
                const top3 = diverse.slice(0, 3);
                const explained = await Promise.all(top3.map(async (p) => {
                    try {
                        const res = await generateRecommendationReason({
                            productName: p.name,
                            productPrice: p.price,
                            productRating: p.rating || 5,
                            userQuery: searchQuery
                        });
                        return { ...p, aiReason: res.reasons };
                    } catch (e) {
                        return p;
                    }
                }));
                
                setRankedProducts([
                    ...explained,
                    ...diverse.slice(3)
                ]);
            } catch (err) {
                setRankedProducts(diverse);
            } finally {
                setIsExplaining(false);
            }
        } else {
            setRankedProducts(diverse);
        }
    };

    runExplainer();
  }, [candidates, marketProfile, vibeProfile, user, searchQuery, parsedIntent, isParsing]);

  // SPECIALIZED DISCOVERY SECTIONS
  const trending = useMemo(() => {
    return rankedProducts
      .filter(p => (p.trendScore || 0) > 0)
      .sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0))
      .slice(0, 10);
  }, [rankedProducts]);

  const deals = useMemo(() => {
    return rankedProducts
      .filter(p => computeDealBoost(p.averagePrice, p.price) > 0)
      .sort((a, b) => computeDealBoost(b.averagePrice, b.price) - computeDealBoost(a.averagePrice, a.price))
      .slice(0, 10);
  }, [rankedProducts]);

  const topRated = useMemo(() => {
    return rankedProducts
      .filter(p => computeVendorScore(p) > 10)
      .sort((a, b) => computeVendorScore(b) - computeVendorScore(a))
      .slice(0, 10);
  }, [rankedProducts]);

  return {
    products: rankedProducts,
    trending,
    deals,
    topRated,
    isLoading: isLoadingCandidates || isLoadingProfile || !isVibeLoaded || isParsing,
    isParsing,
    isExplaining,
    hasProfile: !!marketProfile || !!vibeProfile,
    intent: parsedIntent
  };
}
