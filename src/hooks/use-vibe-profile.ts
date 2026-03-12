
'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { doc, getDoc, onSnapshot, Firestore } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { SocialPost, UserIntelligence, VibeSignal } from '@/lib/types';
import { recordUnifiedSignal } from '@/lib/user-intelligence';

/**
 * useVibeProfile Hook
 * -------------------
 * Refactored to use the Unified User Intelligence Engine.
 * Manages local state for fast UI updates while syncing with the global brain.
 */
export function useVibeProfile() {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  const [intelligence, setIntelligence] = useState<Partial<UserIntelligence>>({
    interests: {},
    affinities: { creators: {}, vendors: {} },
    engagementLevel: 0
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // 🏎️ Real-time Listener for the Unified Brain
  useEffect(() => {
    if (!firestore || !user?.id) {
      setIsLoaded(true);
      return;
    }

    const unsub = onSnapshot(doc(firestore, 'user_intelligence', user.id), (snap) => {
      if (snap.exists()) {
        setIntelligence(snap.data() as UserIntelligence);
      }
      setIsLoaded(true);
    }, () => setIsLoaded(true));

    return () => unsub();
  }, [firestore, user?.id]);

  /**
   * recordSignal
   * ------------
   * Relays a social vibe signal to the Unified Intelligence Engine.
   */
  const recordSignal = useCallback(async (post: SocialPost, signal: VibeSignal) => {
    if (!firestore || !user?.id) return;

    recordUnifiedSignal(firestore, user.id, signal, {
      tags: [...(post.tags || []), ...(post.aiTags || [])],
      creatorId: post.authorId
    });
  }, [firestore, user?.id]);

  /**
   * getPersonalScore
   * ----------------
   * Calculates a relevance score for a post based on the Unified profile.
   */
  const getPersonalScore = useCallback((post: SocialPost): number => {
    if (!isLoaded || !intelligence.interests) return 0;
    
    let score = 0;
    const postTags = [...(post.tags || []), ...(post.aiTags || [])].map(t => t.toLowerCase());

    // 1. Interest Matching (Shared social/market data)
    postTags.forEach(tag => {
      score += (intelligence.interests![tag] || 0) * 0.8;
    });

    // 2. Creator Affinity
    if (post.authorId && intelligence.affinities?.creators?.[post.authorId]) {
      score += (intelligence.affinities.creators[post.authorId]) * 1.5;
    }

    return score;
  }, [intelligence, isLoaded]);

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
    recordSignal, 
    getPersonalScore, 
    getTopInterests 
  };
}
