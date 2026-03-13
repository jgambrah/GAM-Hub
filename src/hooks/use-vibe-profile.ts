'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { SocialPost, UserIntelligence, VibeSignal } from '@/lib/types';
import { recordUnifiedSignal, updateVideoInterest } from '@/lib/user-intelligence';
import { expandInterests } from '@/lib/knowledge-graph';
import { selectStrategy, type GlobalBanditStats } from '@/lib/bandit-learning';
import type { FeedStrategyId } from '@/lib/feed-strategies';
import { generateUserEmbedding } from '@/ai/flows/update-user-embedding';
import { cosineSimilarity } from '@/lib/utils';

/**
 * useVibeProfile Hook
 * -------------------
 * Manages the local state for the Unified User Intelligence Engine.
 * Orchestrates the Multi-Armed Bandit feed strategy selection.
 */
export function useVibeProfile() {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  const [intelligence, setIntelligence] = useState<Partial<UserIntelligence>>({
    interests: {},
    affinities: { creators: {}, vendors: {} },
    engagementLevel: 0
  });
  
  const [expandedInterestsMap, setExpandedInterests] = useState<Record<string, number>>({});
  const [currentStrategy, setCurrentStrategy] = useState<FeedStrategyId | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Unified Brain Sync
  useEffect(() => {
    if (!firestore || !user?.id) {
      setIsLoaded(true);
      return;
    }

    const unsub = onSnapshot(doc(firestore, 'user_intelligence', user.id), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserIntelligence;
        setIntelligence(data);

        // 🕸️ GRAPH EXPANSION
        if (data.interests) {
            const topDirect = Object.entries(data.interests)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([id]) => id);
            
            try {
                const expanded = await expandInterests(firestore, topDirect);
                setExpandedInterests(expanded);
            } catch (e) {
                console.warn("Graph expansion drifted.");
            }
        }
      }
      setIsLoaded(true);
    }, () => setIsLoaded(true));

    return () => unsub();
  }, [firestore, user?.id]);

  // 2. 🎰 BANDIT STRATEGY SELECTION
  useEffect(() => {
    if (!firestore || !user?.id || !isLoaded) return;

    if (intelligence.currentStrategy) {
      setCurrentStrategy(intelligence.currentStrategy as FeedStrategyId);
    } else {
      // Choose an initial strategy using global performance stats
      const statsRef = doc(firestore, 'bandit_stats', 'global');
      getDoc(statsRef).then(snap => {
        const stats = snap.exists() ? snap.data() as GlobalBanditStats : {} as GlobalBanditStats;
        const selected = selectStrategy(stats);
        setCurrentStrategy(selected);
        
        // Persist choice to the user's permanent brain
        setDoc(doc(firestore, 'user_intelligence', user.id), { 
            currentStrategy: selected 
        }, { merge: true });
      });
    }
  }, [firestore, user?.id, isLoaded, intelligence.currentStrategy]);

  /**
   * getPersonalScore
   */
  const getPersonalScore = useCallback((post: SocialPost): number => {
    if (!isLoaded || !intelligence.interests) return 0;
    
    let score = 0;
    const postTags = [
      ...(post.tags || []), 
      ...(post.aiTags || [])
    ].map(t => t.toLowerCase());

    postTags.forEach(tag => {
      // Direct Signal Boost (2x Weight)
      const directWeight = intelligence.interests![tag] || 0;
      score += directWeight * 2.0; 

      // Graph Relationship Boost (0.8x Weight)
      const graphWeight = expandedInterestsMap[tag] || 0;
      score += graphWeight * 0.8;
    });

    // 🧠 NEURAL VECTOR MATCHING
    if (intelligence.tasteVector && post.embedding) {
        const similarity = cosineSimilarity(intelligence.tasteVector, post.embedding);
        if (similarity > 0.8) {
            score += similarity * 50; // Dynamic neural boost
        }
    }

    // Creator Affinity
    if (post.authorId && intelligence.affinities?.creators?.[post.authorId]) {
      score += (intelligence.affinities.creators[post.authorId]) * 1.5;
    }

    return score;
  }, [intelligence, expandedInterestsMap, isLoaded]);

  const getTopInterests = useCallback((n = 8): string[] => {
    if (!intelligence.interests) return [];
    return Object.entries(intelligence.interests)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([tag]) => tag);
  }, [intelligence.interests]);

  return { 
    profile: intelligence, 
    sessionProfile: intelligence, // Backwards compat
    isLoaded, 
    currentStrategy,
    recordSignal: (post: SocialPost, signal: VibeSignal) => {
        if (!firestore || !user?.id) return;
        if (signal === 'watch') updateVideoInterest(firestore, user.id, post);
        
        recordUnifiedSignal(firestore, user.id, signal, {
            tags: [...(post.tags || []), ...(post.aiTags || [])],
            creatorId: post.authorId
        }, currentStrategy);
    },
    getPersonalScore, 
    getTopInterests 
  };
}
