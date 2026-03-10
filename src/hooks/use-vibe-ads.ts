'use client';

/**
 * useVibeAds
 * ----------
 * Fetches active ad campaigns from Firestore, filters them to the current
 * user's campus and mood, respects per-user daily frequency caps, and
 * ranks the survivors by profile relevance so the most relevant ad shows first.
 *
 * Returns:
 *   ads          — ranked list of eligible AdCampaign objects
 *   recordImpression(adId) — call when an ad enters the viewport
 *   recordClick(ad)        — call when the student taps the CTA
 *   getAdForSlot(index)    — picks the best ad for a given feed slot index
 *                             (returns null if no eligible ad)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, query, where, getDocs,
  doc, getDoc, setDoc, addDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { AdCampaign } from '@/components/social/vibeAdsSchema';
import { useVibeProfile } from './use-vibe-profile';
import type { VibeMood } from '@/components/social/VibePlayerContext';

// ── How often an ad slot appears in the feed ─────────────────────────────────
// Every AD_INTERVAL posts, one ad is injected.
// e.g. AD_INTERVAL = 5 → post, post, post, post, post, AD, post, post...
export const AD_INTERVAL = 5;

// ── Session-level impression dedup ───────────────────────────────────────────
// We only count one impression per ad per scroll session to avoid over-charging
// advertisers when a student scrolls up and down past the same card.
const sessionImpressions = new Set<string>();

// ── Today's date key (YYYY-MM-DD) for daily cap checks ───────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function useVibeAds(activeMood: VibeMood) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { profile } = useVibeProfile();

  const [rawAds, setRawAds]     = useState<AdCampaign[]>([]);
  const [capMap, setCapMap]     = useState<Record<string, number>>({}); // adId → today's impression count for this user
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Fetch active campaigns on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!firestore) return;
    const q = query(
      collection(firestore, 'ad_campaigns'),
      where('status', '==', 'active'),
    );
    getDocs(q).then(snap => {
      const now = Date.now();
      const campaigns = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AdCampaign))
        .filter(ad => {
          // Only ads within their scheduled window
          const start = ad.startDate?.toMillis?.() ?? 0;
          const end   = ad.endDate?.toMillis?.() ?? Infinity;
          return now >= start && now <= end;
        });
      setRawAds(campaigns);
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, [firestore]);

  // ── Load today's per-user cap counts for each ad ────────────────────────────
  useEffect(() => {
    if (!firestore || !user?.id || rawAds.length === 0) return;
    const today = todayKey();
    const fetches = rawAds.map(async ad => {
      const capRef = doc(firestore, 'ad_impressions_daily', `${ad.id}_${user.id}_${today}`);
      try {
        const snap = await getDoc(capRef);
        return [ad.id, snap.exists() ? (snap.data()?.count ?? 0) : 0] as [string, number];
      } catch {
        return [ad.id, 0] as [string, number];
      }
    });
    Promise.all(fetches).then(pairs => {
      setCapMap(Object.fromEntries(pairs));
    });
  }, [firestore, user?.id, rawAds.length]);

  // ── Filter and rank eligible ads ─────────────────────────────────────────────
  const eligibleAds = useMemo((): AdCampaign[] => {
    if (!isLoaded || !user) return [];

    return rawAds
      .filter(ad => {
        // 1. Campus targeting — 'all' means any campus
        const campusMatch =
          ad.campusIds.includes('all') ||
          ad.campusIds.includes(user.campusId ?? '');
        if (!campusMatch) return false;

        // 2. Mood targeting — empty targetMoods means show in any mood
        const moodMatch =
          ad.targetMoods.length === 0 ||
          ad.targetMoods.includes(activeMood) ||
          ad.targetMoods.includes('all');
        if (!moodMatch) return false;

        // 3. Per-user daily frequency cap
        const seenToday = capMap[ad.id] ?? 0;
        if (seenToday >= (ad.perUserDailyCap ?? 3)) return false;

        return true;
      })
      .map(ad => {
        // Relevance score: how well this ad matches user's taste profile
        let relevance = ad.priority * 10; // base = priority (1–10) × 10
        for (const tag of ad.targetTags) {
          relevance += (profile.tagWeights[tag.toLowerCase()] ?? 0) * 0.4;
        }
        return { ad, relevance };
      })
      .sort((a, b) => b.relevance - a.relevance)
      .map(({ ad }) => ad);
  }, [rawAds, capMap, isLoaded, user, activeMood, profile.tagWeights]);

  // ── Ref for stable access in callbacks ──────────────────────────────────────
  const eligibleRef = useRef(eligibleAds);
  useEffect(() => { eligibleRef.current = eligibleAds; }, [eligibleAds]);

  // ── Pick the best ad for a given slot ───────────────────────────────────────
  const getAdForSlot = useCallback((slotIndex: number): AdCampaign | null => {
    const ads = eligibleRef.current;
    if (ads.length === 0) return null;
    return ads[slotIndex % ads.length];
  }, []);

  // ── Record impression ─────────────────────────────────────────────────────
  const recordImpression = useCallback((adId: string) => {
    if (!firestore || !user?.id) return;

    // De-duplicate within this scroll session
    const sessionKey = `${adId}_${user.id}`;
    if (sessionImpressions.has(sessionKey)) return;
    sessionImpressions.add(sessionKey);

    const today = todayKey();

    // 1. Subcollection event (for billing audit trail)
    addDoc(collection(firestore, 'ad_campaigns', adId, 'impressions'), {
      userId:    user.id,
      campusId:  user.campusId ?? '',
      timestamp: serverTimestamp(),
    }).catch(() => {});

    // 2. Daily cap counter (Cloud Function aggregates this)
    const capRef = doc(firestore, 'ad_impressions_daily', `${adId}_${user.id}_${today}`);
    setDoc(capRef, { count: increment(1) }, { merge: true }).catch(() => {});

    // 3. Update local cap map so the UI reflects it immediately
    setCapMap(prev => ({ ...prev, [adId]: (prev[adId] ?? 0) + 1 }));
  }, [firestore, user?.id]);

  // ── Record click ──────────────────────────────────────────────────────────
  const recordClick = useCallback((ad: AdCampaign) => {
    if (!firestore || !user?.id) return;
    addDoc(collection(firestore, 'ad_campaigns', ad.id, 'clicks'), {
      userId:    user.id,
      timestamp: serverTimestamp(),
      ctaUrl:    ad.ctaUrl,
    }).catch(() => {});
    // Open the CTA URL
    window.open(ad.ctaUrl, '_blank', 'noopener,noreferrer');
  }, [firestore, user?.id]);

  return { ads: eligibleAds, isLoaded, getAdForSlot, recordImpression, recordClick };
}
