'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { SocialPost } from '@/lib/types';

export interface VibeProfile {
  tagWeights:    Record<string, number>;
  authorWeights: Record<string, number>;
  typeWeights:   Record<string, number>;
  campusWeights: Record<string, number>;
}

export const EMPTY_PROFILE: VibeProfile = {
  tagWeights:    {},
  authorWeights: {},
  typeWeights:   {},
  campusWeights: {},
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
  skip:           { tag: -1.5, author: -1.0, type: -0.5, campus: -0.2 }, // ⏭️ Skip Punishments
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
  const [isLoaded, setIsLoaded] = useState(false);

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
        });
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, [firestore, user?.id]);

  const recordSignal = useCallback((post: SocialPost, signal: SignalType) => {
    if (!firestore || !user?.id) return;

    const w = SIGNAL_WEIGHTS[signal];
    const tags    = (post.tags || []).map(t => t.toLowerCase());
    const authors = post.authorId ? [post.authorId] : [];
    const types   = [post.mediaType];
    const campus  = post.campusId ? [post.campusId] : [];

    setProfile(prev => {
      const next: VibeProfile = {
        tagWeights:    applyWeights(prev.tagWeights,    tags,    w.tag),
        authorWeights: applyWeights(prev.authorWeights, authors, w.author),
        typeWeights:   applyWeights(prev.typeWeights,   types,   w.type),
        campusWeights: applyWeights(prev.campusWeights, campus,  w.campus),
      };

      const profileRef = doc(firestore, 'vibe_profiles', user.id);
      setDoc(profileRef, { ...next, updatedAt: serverTimestamp() }, { merge: true })
        .catch(err => console.warn('vibe_profile write failed:', err));

      return next;
    });
  }, [firestore, user?.id]);

  const getPersonalScore = useCallback((post: SocialPost): number => {
    if (!isLoaded) return 0;
    let score = 0;

    for (const tag of (post.tags || []).map(t => t.toLowerCase())) {
      score += (profile.tagWeights[tag] ?? 0) * 0.6;
    }
    if (post.authorId) {
      score += (profile.authorWeights[post.authorId] ?? 0) * 0.5;
    }
    if (post.mediaType) {
      score += (profile.typeWeights[post.mediaType] ?? 0) * 0.3;
    }
    if (post.campusId) {
      score += (profile.campusWeights[post.campusId] ?? 0) * 0.2;
    }

    return score;
  }, [profile, isLoaded]);

  const getTopInterests = useCallback((n = 8): string[] => {
    return Object.entries(profile.tagWeights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([tag]) => tag);
  }, [profile]);

  return { profile, isLoaded, recordSignal, getPersonalScore, getTopInterests };
}
