'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { SocialPost } from '@/lib/types';
import { generateUserEmbedding } from '@/ai/flows/update-user-embedding';

export interface VibeProfile {
  tagWeights:    Record<string, number>;
  authorWeights: Record<string, number>;
  typeWeights:   Record<string, number>;
  campusWeights: Record<string, number>;
  vibeEmbedding?: number[]; // THE SEMANTIC TASTE VECTOR
}

export interface SessionProfile {
  tagWeights:    Record<string, number>;
  authorWeights: Record<string, number>;
}

export const EMPTY_PROFILE: VibeProfile = {
  tagWeights:    {},
  authorWeights: {},
  typeWeights:   {},
  campusWeights: {},
};

export const EMPTY_SESSION: SessionProfile = {
  tagWeights:    {},
  authorWeights: {},
};

export type SignalType = 'like' | 'unlike' | 'reaction' | 'play' | 'watched_to_end' | 'skip';

const SIGNAL_WEIGHTS: Record<SignalType, {
  tag: number; author: number; type: number; campus: number;
}> = {
  like:           { tag: 3.0,  author: 2.0,  type: 1.5, campus: 1.0 },
  unlike:         { tag: -2.0, author: -1.0, type: -1.0, campus: -0.5 },
  reaction:       { tag: 2.0,  author: 1.0,  type: 1.0, campus: 0.5 },
  play:           { tag: 1.0,  author: 0.5,  type: 0.5, campus: 0.3 },
  watched_to_end: { tag: 4.0,  author: 3.0,  type: 2.0, campus: 1.5 },
  skip:           { tag: -1.5, author: -1.0, type: -0.5, campus: -0.2 },
};

const CAP   = 100;
const FLOOR = 0;

function clamp(v: number) { return Math.min(CAP, Math.max(FLOOR, v)); }

function applyWeights(
  weights: Record<string, number>,
  keys: string[],
  delta: number
): Record<string, number> {
  const updated = { ...weights };
  for (const key of keys) {
    updated[key] = clamp((updated[key] ?? 0) + delta);
  }
  return updated;
}

export function useVibeProfile() {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  const [profile, setProfile] = useState<VibeProfile>(EMPTY_PROFILE);
  const [sessionProfile, setSessionProfile] = useState<SessionProfile>(EMPTY_SESSION);
  const [isLoaded, setIsLoaded] = useState(false);
  const signalCountRef = useRef(0);
  
  // Track current profile in a ref to use in async side effects without closure staleness
  const currentProfileRef = useRef<VibeProfile>(EMPTY_PROFILE);
  useEffect(() => {
    currentProfileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!firestore || !user?.id) {
      setIsLoaded(true);
      return;
    }
    const profileRef = doc(firestore, 'vibe_profiles', user.id);
    getDoc(profileRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          tagWeights:    data.tagWeights    ?? {},
          authorWeights: data.authorWeights ?? {},
          typeWeights:   data.typeWeights   ?? {},
          campusWeights: data.campusWeights ?? {},
          vibeEmbedding: data.vibeEmbedding,
        });
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, [firestore, user?.id]);

  const getTopInterests = useCallback((n = 8): string[] => {
    // Combine session and persistent for "Top Interests"
    const combinedTags = { ...profile.tagWeights };
    Object.entries(sessionProfile.tagWeights).forEach(([tag, weight]) => {
        combinedTags[tag] = (combinedTags[tag] || 0) + weight * 2; // Weight session higher
    });

    return Object.entries(combinedTags)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([tag]) => tag);
  }, [profile.tagWeights, sessionProfile.tagWeights]);

  const recordSignal = useCallback(async (post: SocialPost, signal: SignalType) => {
    if (!firestore || !user?.id) return;

    const w = SIGNAL_WEIGHTS[signal];
    const tags    = (post.tags || []).map(t => t.toLowerCase());
    const authors = post.authorId ? [post.authorId] : [];
    const types   = [post.mediaType];
    const campus  = post.campusId ? [post.campusId] : [];

    signalCountRef.current += 1;
    const shouldRefreshEmbedding = signalCountRef.current % 5 === 0;

    // 1. UPDATE SESSION PROFILE (IMMEDIATE)
    setSessionProfile(prev => ({
        tagWeights: applyWeights(prev.tagWeights, tags, w.tag),
        authorWeights: applyWeights(prev.authorWeights, authors, w.author),
    }));

    // 2. UPDATE PERSISTENT PROFILE OPTIMISTICALLY
    setProfile(prev => {
      const next: VibeProfile = {
        ...prev,
        tagWeights:    applyWeights(prev.tagWeights,    tags,    w.tag),
        authorWeights: applyWeights(prev.authorWeights, authors, w.author),
        typeWeights:   applyWeights(prev.typeWeights,   types,   w.type),
        campusWeights: applyWeights(prev.campusWeights, campus,  w.campus),
      };
      return next;
    });

    // 3. TRIGGER ASYNC PERSISTENCE (OUTSIDE SETTER)
    const performUpdate = async () => {
      const prev = currentProfileRef.current;
      const next: VibeProfile = {
        ...prev,
        tagWeights:    applyWeights(prev.tagWeights,    tags,    w.tag),
        authorWeights: applyWeights(prev.authorWeights, authors, w.author),
        typeWeights:   applyWeights(prev.typeWeights,   types,   w.type),
        campusWeights: applyWeights(prev.campusWeights, campus,  w.campus),
      };

      let finalEmbedding = next.vibeEmbedding;
      
      if (shouldRefreshEmbedding) {
          const interests = Object.entries(next.tagWeights)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 15)
              .map(([tag]) => tag);
          
          try {
            const newEmbedding = await generateUserEmbedding(interests);
            if (newEmbedding) {
                finalEmbedding = newEmbedding;
                setProfile(p => ({ ...p, vibeEmbedding: newEmbedding }));
            }
          } catch (e) {
            console.warn('Liaison Brain: Embedding generation failed:', e);
          }
      }

      const profileDocRef = doc(firestore, 'vibe_profiles', user.id);
      await setDoc(profileDocRef, { 
          ...next, 
          vibeEmbedding: finalEmbedding,
          updatedAt: serverTimestamp() 
      }, { merge: true });
    };

    performUpdate().catch(err => console.warn('vibe_profile sync failed:', err));

  }, [firestore, user?.id, currentProfileRef]);

  const getPersonalScore = useCallback((post: SocialPost): number => {
    if (!isLoaded) return 0;
    let score = 0;

    // 1. HISTORICAL PERSISTENT WEIGHTS
    for (const tag of (post.tags || []).map(t => t.toLowerCase())) {
      score += (profile.tagWeights[tag] ?? 0) * 0.6;
    }
    if (post.authorId) {
      score += (profile.authorWeights[post.authorId] ?? 0) * 0.5;
    }
    
    // 2. SESSION BOOST: Hyper-responsive short-term memory
    // Applied based on computeSessionBoost.ts logic
    for (const tag of (post.tags || []).map(t => t.toLowerCase())) {
      if (sessionProfile.tagWeights[tag]) {
        score += sessionProfile.tagWeights[tag] * 2;
      }
    }
    
    if (post.authorId && sessionProfile.authorWeights[post.authorId]) {
      score += sessionProfile.authorWeights[post.authorId] * 3;
    }

    // 3. CATEGORY & CAMPUS CONTEXT
    if (post.mediaType) {
      score += (profile.typeWeights[post.mediaType] ?? 0) * 0.3;
    }
    if (post.campusId) {
      score += (profile.campusWeights[post.campusId] ?? 0) * 0.2;
    }

    return score;
  }, [profile, sessionProfile, isLoaded]);

  return { profile, sessionProfile, isLoaded, recordSignal, getPersonalScore, getTopInterests };
}
