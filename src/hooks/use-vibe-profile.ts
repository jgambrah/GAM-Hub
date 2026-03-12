
'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, Firestore } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { SocialPost, UserIntelligence, VibeSignal } from '@/lib/types';
import { recordUnifiedSignal, updateVideoInterest } from '@/lib/user-intelligence';
import { expandInterests } from '@/lib/knowledge-graph';

/**
 * useVibeProfile Hook
 * -------------------
 * Manages the local state for the Unified User Intelligence Engine.
 * Upgraded with Knowledge Graph "Expansion" for smarter discovery.
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
  const [isLoaded, setIsLoaded] = useState(false);

  // 🏎️ Real-time Listener for the Unified Brain
  useEffect(() => {
    if (!firestore || !user?.id) {
      setIsLoaded(true);
      return;
    }

    const unsub = onSnapshot(doc(firestore, 'user_intelligence', user.id), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserIntelligence;
        setIntelligence(data);

        // 🕸️ GRAPH EXPANSION: Discover related topics the user might like
        if (data.interests) {
            const topDirect = Object.entries(data.interests)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([id]) => id);
            
            const expanded = await expandInterests(firestore, topDirect);
            setExpandedInterests(expanded);
        }
      }
      setIsLoaded(true);
    }, () => setIsLoaded(true));

    return () => unsub();
  }, [firestore, user?.id]);

  /**
   * getPersonalScore
   * ----------------
   * KNOWLEDGE GRAPH DISCOVERY:
   * Boosts content by 2x for direct matches and 0.8x for graph-expanded matches.
   */
  const getPersonalScore = useCallback((post: SocialPost): number => {
    if (!isLoaded || !intelligence.interests) return 0;
    
    let score = 0;
    const postTags = [
      ...(post.tags || []), 
      ...(post.aiTags || [])
    ].map(t => t.toLowerCase());

    postTags.forEach(tag => {
      // 🎯 1. Direct Signal Boost (2x)
      const directWeight = intelligence.interests![tag] || 0;
      score += directWeight * 2.0; 

      // 🕸️ 2. Graph Relationship Boost (0.8x)
      // This surfaces content that is 'near' your interests in the graph
      const graphWeight = expandedInterestsMap[tag] || 0;
      score += graphWeight * 0.8;
    });

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
    isLoaded, 
    recordSignal: (post: SocialPost, signal: VibeSignal) => {
        if (!firestore || !user?.id) return;
        if (signal === 'watch') updateVideoInterest(firestore, user.id, post);
        recordUnifiedSignal(firestore, user.id, signal, {
            tags: [...(post.tags || []), ...(post.aiTags || [])],
            creatorId: post.authorId
        });
    },
    getPersonalScore, 
    getTopInterests 
  };
}
