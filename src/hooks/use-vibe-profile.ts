
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, Firestore } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { SocialPost, UserIntelligence, VibeSignal } from '@/lib/types';
import { recordUnifiedSignal, updateVideoInterest } from '@/lib/user-intelligence';

/**
 * useVibeProfile Hook
 * -------------------
 * Manages the local state for the Unified User Intelligence Engine.
 * Implements the 2x Personalization Boost for discovery ranking.
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

    // Direct interest update for video watches
    if (signal === 'watch') {
        updateVideoInterest(firestore, user.id, post);
    }

    recordUnifiedSignal(firestore, user.id, signal, {
      tags: [...(post.tags || []), ...(post.aiTags || [])],
      creatorId: post.authorId
    });
  }, [firestore, user?.id]);

  /**
   * getPersonalScore
   * ----------------
   * UNIFIED INTEREST SCORING:
   * Boosts content relevance by 2x for matched interests from the unified brain.
   */
  const getPersonalScore = useCallback((post: SocialPost): number => {
    if (!isLoaded || !intelligence.interests) return 0;
    
    let score = 0;
    const postTags = [
      ...(post.tags || []), 
      ...(post.aiTags || [])
    ].map(t => t.toLowerCase());

    // 🎯 THE BOOST: score += userInterest[tag] * 2
    // This makes the feed feel extremely personalized based on BOTH social and market signals.
    postTags.forEach(tag => {
      const interestWeight = intelligence.interests![tag] || 0;
      score += interestWeight * 2.0; 
    });

    // Creator Affinity: High boost for creators the user engages with
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
