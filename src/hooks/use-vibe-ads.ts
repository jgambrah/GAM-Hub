'use client';

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

export const AD_INTERVAL = 5;
const sessionImpressions = new Set<string>();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function useVibeAds(activeMood: VibeMood) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { profile } = useVibeProfile();

  const [rawAds, setRawAds]     = useState<AdCampaign[]>([]);
  const [capMap, setCapMap]     = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

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
          const start = ad.startDate?.toMillis?.() ?? 0;
          const end   = ad.endDate?.toMillis?.() ?? Infinity;
          return now >= start && now <= end;
        });
      setRawAds(campaigns);
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, [firestore]);

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

  const eligibleAds = useMemo((): AdCampaign[] => {
    if (!isLoaded || !user) return [];

    return rawAds
      .filter(ad => {
        const campusMatch =
          ad.campusIds.includes('all') ||
          ad.campusIds.includes(user.campusId ?? '');
        if (!campusMatch) return false;

        const moodMatch =
          ad.targetMoods.length === 0 ||
          ad.targetMoods.includes(activeMood) ||
          ad.targetMoods.includes('all');
        if (!moodMatch) return false;

        const seenToday = capMap[ad.id] ?? 0;
        if (seenToday >= (ad.perUserDailyCap ?? 3)) return false;

        return true;
      })
      .map(ad => {
        let relevance = ad.priority * 10;
        for (const tag of ad.targetTags) {
          relevance += (profile.tagWeights[tag.toLowerCase()] ?? 0) * 0.4;
        }
        return { ad, relevance };
      })
      .sort((a, b) => b.relevance - a.relevance)
      .map(({ ad }) => ad);
  }, [rawAds, capMap, isLoaded, user, activeMood, profile.tagWeights]);

  const eligibleRef = useRef(eligibleAds);
  useEffect(() => { eligibleRef.current = eligibleAds; }, [eligibleAds]);

  const getAdForSlot = useCallback((slotIndex: number): AdCampaign | null => {
    const ads = eligibleRef.current;
    if (ads.length === 0) return null;
    return ads[slotIndex % ads.length];
  }, []);

  const recordImpression = useCallback((adId: string) => {
    if (!firestore || !user?.id) return;
    const sessionKey = `${adId}_${user.id}`;
    if (sessionImpressions.has(sessionKey)) return;
    sessionImpressions.add(sessionKey);

    const today = todayKey();
    addDoc(collection(firestore, 'ad_campaigns', adId, 'impressions'), {
      userId:    user.id,
      campusId:  user.campusId ?? '',
      timestamp: serverTimestamp(),
    }).catch(() => {});

    const capRef = doc(firestore, 'ad_impressions_daily', `${adId}_${user.id}_${today}`);
    setDoc(capRef, { count: increment(1) }, { merge: true }).catch(() => {});
    setCapMap(prev => ({ ...prev, [adId]: (prev[adId] ?? 0) + 1 }));
  }, [firestore, user?.id]);

  const recordClick = useCallback((ad: AdCampaign) => {
    if (!firestore || !user?.id) return;
    addDoc(collection(firestore, 'ad_campaigns', ad.id, 'clicks'), {
      userId:    user.id,
      timestamp: serverTimestamp(),
      ctaUrl:    ad.ctaUrl,
    }).catch(() => {});
    window.open(ad.ctaUrl, '_blank', 'noopener,noreferrer');
  }, [firestore, user?.id]);

  return { ads: eligibleAds, isLoaded, getAdForSlot, recordImpression, recordClick };
}
