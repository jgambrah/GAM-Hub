
'use client';

/**
 * @fileOverview Liaison Vibe Player Orchestrator.
 * 🚀 ACTIVE ENGINES:
 * 1. Two-Stage Ranking (Retrieval + Scoring)
 * 2. Discovery Mix (Interleaving + Diversity)
 * 3. Hashtag Intel (Graph co-occurrence)
 * 4. Unified Profile (Social-Commercial Merge)
 * 5. Knowledge Graph (Semantic Expansion)
 * 6. Real-Time Trend (5x Weight Injection)
 * 7. Multi-Armed Bandit (Strategy Learning)
 * 8. AI Re-Ranking (LLM Refinement)
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { SocialPost } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { recordEngagement } from '@/lib/trending-service';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { getRelatedHashtags } from '@/lib/hashtag-utils';
import { enforceDiversity } from '@/lib/diversity-engine';
import { logTrendEvent } from '@/lib/trend-logger';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';

export type MediaCategory = 'video' | 'image' | 'text';

export function getMediaCategory(mediaType: SocialPost['mediaType']): MediaCategory {
  if (mediaType === 'youtube' || mediaType === 'video' || mediaType === 'tiktok') return 'video';
  if (mediaType === 'image') return 'image';
  return 'text';
}

export function getMediaLabel(mediaType: SocialPost['mediaType']): string {
  const map: Record<string, string> = {
    youtube: 'YouTube', video: 'Video', tiktok: 'TikTok', image: 'Photo', text: 'Post',
  };
  return map[mediaType] ?? mediaType;
}

export const DISPLAY_DURATIONS: Record<MediaCategory, number> = {
  video: 0, image: 8000, text: 6000,
};

export type VibeMood = 'all' | 'hype' | 'chill' | 'study' | 'flex';

export const VIBE_MOODS: { id: VibeMood; label: string; emoji: string; tags: string[] }[] = [
  { id: 'all',   label: 'All Vibes', emoji: '🎵', tags: [] },
  { id: 'hype',  label: 'Hype',      emoji: '🔥', tags: ['hype', 'lit', 'turnt', 'party', 'energy', 'afrobeats', 'amapiano'] },
  { id: 'chill', label: 'Chill',     emoji: '🌊', tags: ['chill', 'relax', 'lofi', 'vibes', 'smooth', 'afrosoul', 'rnb'] },
  { id: 'study', label: 'Study',     emoji: '📚', tags: ['study', 'focus', 'lofi', 'instrumental', 'calm', 'concentration'] },
  { id: 'flex',  label: 'Flex',      emoji: '💎', tags: ['flex', 'drip', 'swag', 'bars', 'rap', 'afrotrap', 'drill'] },
];

export type VibeReaction = '🔥' | '🌊' | '💎' | '👑' | '⚡';
export const REACTIONS: VibeReaction[] = ['🔥', '🌊', '💎', '👑', '⚡'];

export interface ReactionBurst {
  id: string; emoji: VibeReaction; x: number; y: number;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0; let magA = 0; let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA); magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function exponentialFreshness(date: Date) {
  const ageHours = (Date.now() - date.getTime()) / 3600000;
  return 10 * Math.exp(-ageHours / 12);
}

export function explorationBoost(post: SocialPost) {
  const views = post.likes || 0; 
  if (views < 50) return 15;
  if (views < 200) return 8;
  return 0;
}

/**
 * computeVibeScore
 * ---------------
 * STAGE 2-4: Local Hybrid Scoring
 */
export function computeVibeScore(
  current: SocialPost, 
  candidate: SocialPost, 
  getPersonalScore: (p: SocialPost) => number,
  globalTrendScores: Record<string, number> = {},
  viralTags: Set<string>, 
  trendingTags: Set<string>, 
  relatedTags: Set<string>,
  creatorReputation: Record<string, any> = {},
  activeMoodId: VibeMood = 'all'
) {
  let score = 0;
  
  // 🎯 STAGE 2: Personalization Match
  score += getPersonalScore(candidate);

  // 🚀 STAGE 4: REAL-TIME TREND BOOST (5x Weight)
  const globalTrendValue = globalTrendScores[candidate.id] || 0;
  score += globalTrendValue * 5;

  // 🕸️ STAGE 3: Tag & Semantic Continuity (Graph & Embedding)
  const currentTags = new Set([...(current.tags || []), ...(current.aiTags || [])].map(t => t.toLowerCase()));
  const candidateTags = [...(candidate.tags || []), ...(candidate.aiTags || [])].map(t => t.toLowerCase());
  
  const tagMatches = candidateTags.filter(t => currentTags.has(t));
  score += tagMatches.length * 15;

  candidateTags.forEach(tag => {
      const tagTrend = globalTrendScores[tag] || 0;
      score += tagTrend * 2;
  });

  if (current.embedding && candidate.embedding) {
    const similarity = cosineSimilarity(current.embedding, candidate.embedding);
    if (similarity > 0.85) score += 20;
  }

  if (candidate.mood && activeMoodId !== 'all') {
    const moodDef = VIBE_MOODS.find(m => m.id === activeMoodId);
    if (moodDef?.tags.includes(candidate.mood.toLowerCase())) score += 15;
  }

  if (candidate.commerceClicks) {
      score += Math.min(candidate.commerceClicks * 5, 50);
  }

  score += explorationBoost(candidate);
  
  const repData = creatorReputation[candidate.authorId] || { qualityScore: 50 };
  score += (repData.qualityScore || 50) * 0.5;

  if (candidate.createdAt) {
    const date = typeof candidate.createdAt === 'string' ? new Date(candidate.createdAt) : (candidate.createdAt.toDate ? candidate.createdAt.toDate() : new Date(candidate.createdAt));
    score += exponentialFreshness(date);
  }

  return score;
}

export function buildSmartQueue(
  current: SocialPost, pool: SocialPost[], mood: VibeMood, getPersonalScore: (p: SocialPost) => number,
  globalTrendScores: Record<string, number> = {},
  viralTags: Set<string> = new Set(), trendingTags: Set<string> = new Set(), relatedTags: Set<string> = new Set(),
  creatorReputation: Record<string, any> = {}
) {
  const scored = pool
    .filter(p => p.id !== current.id)
    .map(p => ({
        post: p,
        score: computeVibeScore(current, p, getPersonalScore, globalTrendScores, viralTags, trendingTags, relatedTags, creatorReputation, mood)
    }));

  scored.sort((a, b) => b.score - a.score);

  const finalRanked = [];
  const candidates = [...scored];
  const seenClusters = new Map<string, number>();
  const creatorSessionCount = new Map<string, number>();
  const lastCreatorPositions = new Map<string, number>();
  const MIN_CREATOR_GAP = 4;

  while (candidates.length > 0 && finalRanked.length < 50) {
      const currentIndex = finalRanked.length;
      const window = candidates.slice(0, 20).map(c => {
          const cluster = (c.post.tags?.[0] || 'none').toLowerCase();
          const creatorId = c.post.authorId;
          const clusterFreq = seenClusters.get(cluster) || 0;
          const creatorFreq = creatorSessionCount.get(creatorId) || 0;
          const lastPos = lastCreatorPositions.get(creatorId);
          
          let diverseScore = c.score;
          diverseScore -= (clusterFreq * 6); 
          diverseScore -= (creatorFreq * 8); 
          
          if (lastPos !== undefined && (currentIndex - lastPos < MIN_CREATOR_GAP)) {
              diverseScore -= 40; 
          }
          return { ...c, diverseScore };
      });

      window.sort((a, b) => b.diverseScore - a.diverseScore);
      const best = window[0];
      finalRanked.push(best);

      const cluster = (best.post.tags?.[0] || 'none').toLowerCase();
      seenClusters.set(cluster, (seenClusters.get(cluster) || 0) + 1);
      creatorSessionCount.set(best.post.authorId, (creatorSessionCount.get(best.post.authorId) || 0) + 1);
      lastCreatorPositions.set(best.post.authorId, currentIndex);

      const idx = candidates.findIndex(c => c.post.id === best.post.id);
      candidates.splice(idx, 1);
  }
  return finalRanked;
}

export interface QueueEntry { post: SocialPost; score: number; reason: string; }
export const HISTORY_MAX = 30;
export const MAX_POOL_SIZE = 800;

interface VibePlayerContextType {
  activePostId: string | null; activePost: SocialPost | null; queue: SocialPost[]; upNext: QueueEntry[];
  isContinuous: boolean; isLoadingQueue: boolean; setActivePost: (post: SocialPost | null) => void;
  setIsContinuous: (val: boolean) => void; playNext: () => void; playPrev: () => void; addToQueue: (posts: SocialPost[]) => void;
  activeMood: VibeMood; setActiveMood: (mood: VibeMood) => void; history: SocialPost[]; clearHistory: () => void;
  reactionBursts: ReactionBurst[]; sendReaction: (emoji: VibeReaction, post: SocialPost) => void;
  reactionCounts: Record<string, Record<VibeReaction, number>>; isMiniPlayerVisible: boolean;
  sortFeedByProfile: (posts: SocialPost[]) => SocialPost[]; isProfileLoaded: boolean;
  recordPlay: (post: SocialPost) => void; recordWatchedToEnd: (post: SocialPost) => void;
  recordLike: (post: SocialPost) => void; recordUnlike: (post: SocialPost) => void; recordLikeSignal: (post: SocialPost) => void; recordSkip: (post: SocialPost) => void;
}

const VibePlayerContext = createContext<VibePlayerContextType | undefined>(undefined);

export function VibePlayerProvider({ children }: { children: React.ReactNode }) {
  const { firestore } = useFirebase();
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePost, setActivePostState] = useState<SocialPost | null>(null);
  const [queue, setQueue] = useState<SocialPost[]>([]);
  const [upNext, setUpNext] = useState<QueueEntry[]>([]);
  const [allPosts, setAllPosts] = useState<SocialPost[]>([]);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [activeMood, setActiveMoodState] = useState<VibeMood>('all');
  const [history, setHistory] = useState<SocialPost[]>([]);
  const [reactionBursts, setReactionBursts] = useState<ReactionBurst[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<VibeReaction, number>>>({});
  const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(true);
  
  const { profile, sessionProfile, recordSignal, getPersonalScore, getTopInterests, isLoaded: isProfileLoaded } = useVibeProfile();

  const [globalTrendScores, setGlobalTrendScores] = useState<Record<string, number>>({});
  const [viralTags, setViralTags] = useState<Set<string>>(new Set());
  const [trendingTags, setTrendingTags] = useState<Set<string>>(new Set());
  const [creatorReputation, setCreatorReputation] = useState<Record<string, any>>({});

  const displayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<SocialPost[]>([]);
  const allPostsRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const activePostRef = useRef<SocialPost | null>(null);
  const isContinuousRef = useRef(false);
  const activeMoodRef = useRef<VibeMood>('all');
  const getPersonalScoreRef = useRef(getPersonalScore);
  const globalTrendScoresRef = useRef(globalTrendScores);
  const viralTagsRef = useRef(viralTags);
  const trendingTagsRef = useRef(trendingTags);
  const creatorReputationRef = useRef(creatorReputation);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { allPostsRef.current = allPosts; }, [allPosts]);
  useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  useEffect(() => { activePostRef.current = activePost; }, [activePost]);
  useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);
  useEffect(() => { activeMoodRef.current = activeMood; }, [activeMood]);
  useEffect(() => { getPersonalScoreRef.current = getPersonalScore; }, [getPersonalScore]);
  useEffect(() => { globalTrendScoresRef.current = globalTrendScores; }, [globalTrendScores]);
  useEffect(() => { viralTagsRef.current = viralTags; }, [viralTags]);
  useEffect(() => { trendingTagsRef.current = trendingTags; }, [trendingTags]);
  useEffect(() => { creatorReputationRef.current = creatorReputation; }, [creatorReputation]);

  useEffect(() => {
    if (!firestore) return;

    const unsubTrends = onSnapshot(doc(firestore, 'trend_scores', 'current'), (snap) => {
        if (snap.exists()) setGlobalTrendScores(snap.data() as Record<string, number>);
    });

    getDocs(query(collection(firestore, 'hashtags'), orderBy('trendScore', 'desc'), limit(20))).then(snap => {
        const viral = new Set<string>(); const trending = new Set<string>();
        snap.docs.forEach(d => {
            const data = d.data(); const tag = data.tag?.toLowerCase(); if (!tag) return;
            if (data.trendScore > 30) viral.add(tag); else if (data.trendScore > 15) trending.add(tag);
        });
        setViralTags(viral); setTrendingTags(trending);
    });

    const q = query(collection(firestore, 'creator_reputation'), orderBy('qualityScore', 'desc'), limit(200));
    const unsubRep = onSnapshot(q, (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(d => { map[d.id] = { qualityScore: d.data().qualityScore || 50, violationScore: d.data().violationScore || 0 }; });
      setCreatorReputation(map);
    });

    return () => { unsubTrends(); unsubRep(); };
  }, [firestore]);

  const clearDisplayTimer = useCallback(() => {
    if (displayTimerRef.current) { clearTimeout(displayTimerRef.current); displayTimerRef.current = null; }
  }, []);

  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[], mood: VibeMood) => {
    setIsLoadingQueue(true);
    const scorer = getPersonalScoreRef.current;
    const trends = globalTrendScoresRef.current;
    const viral = viralTagsRef.current;
    const trending = trendingTagsRef.current;
    const reputations = creatorReputationRef.current;
    
    let relatedTags = new Set<string>();
    if ((current.tags || []).length > 0 && firestore) {
        try {
            const res = await Promise.all(current.tags!.slice(0, 3).map(tag => getRelatedHashtags(firestore, tag)));
            res.flat().forEach(r => { if (r.weight > 5) relatedTags.add(r.tag.toLowerCase()); });
        } catch (e) { console.warn("Graph lookup failed"); }
    }

    const rankedResults = buildSmartQueue(current, pool, mood, scorer, trends, viral, trending, relatedTags, reputations);
    let finalPosts = rankedResults.map(r => r.post);

    // 🤖 STAGE 5: AI RE-RANKING (Genkit Flow)
    if (finalPosts.length > 5) {
        try {
            const aiReRank = await getRecommendedVibes({
                currentPostContent: current.content,
                userInterests: getTopInterests(10),
                availablePosts: finalPosts.slice(0, 15).map(p => ({
                    id: p.id,
                    content: p.content,
                    tags: p.tags
                }))
            });

            const aiOrder = new Map(aiReRank.recommendedPostIds.map((id, i) => [id, i]));
            const topTier = finalPosts.filter(p => aiOrder.has(p.id))
                .sort((a, b) => aiOrder.get(a.id)! - aiOrder.get(b.id)!);
            const others = finalPosts.filter(p => !aiOrder.has(p.id));
            
            finalPosts = [...topTier, ...others];
        } catch (e) {
            console.warn("Liaison AI Re-Ranking drifted. Falling back to local score.");
        }
    }

    const diversePool = enforceDiversity(finalPosts).slice(0, 30);
    
    const makeUpNext = (ranked: SocialPost[]): QueueEntry[] =>
      ranked.slice(0, 15).map(p => ({
        post: p,
        score: computeVibeScore(current, p, scorer, trends, viral, trending, relatedTags, reputations, mood),
        reason: 'AI Orchestrated Match',
      }));

    setQueue([current, ...diversePool]);
    setUpNext(makeUpNext(diversePool));
    setIsLoadingQueue(false);
  }, [firestore, getTopInterests]);

  useEffect(() => {
    if (activePost && allPosts.length > 0) {
        const timer = setTimeout(() => { rebuildQueue(activePost, allPosts, activeMood); }, 500);
        return () => clearTimeout(timer);
    }
  }, [sessionProfile, activeMood, rebuildQueue, activePost, allPosts]);

  const recordPlay = useCallback((p: SocialPost) => {
    recordSignal(p, 'watch');
    if (firestore) {
        recordEngagement(firestore, p.id, 'view', p.authorId, p.createdAt);
        logTrendEvent(firestore, { type: 'video_view', entityId: p.id, campusId: p.campusId, tag: p.tags?.[0] });
    }
  }, [recordSignal, firestore]);

  const recordWatchedToEnd = useCallback((p: SocialPost) => {
    recordSignal(p, 'watch');
    if (firestore) recordEngagement(firestore, p.id, 'completion', p.authorId, p.createdAt);
  }, [recordSignal, firestore]);

  const recordLike = useCallback((p: SocialPost) => {
    recordSignal(p, 'like');
    if (firestore) {
        logTrendEvent(firestore, { type: 'video_like', entityId: p.id, campusId: p.campusId, tag: p.tags?.[0] });
    }
  }, [recordSignal, firestore]);

  const recordUnlike = useCallback((p: SocialPost) => recordSignal(p, 'like'), [recordSignal]);
  const recordSkip = useCallback((p: SocialPost) => recordSignal(p, 'skip'), [recordSignal]);

  const sortFeedByProfile = useCallback((posts: SocialPost[]): SocialPost[] => {
    if (!isProfileLoaded) return posts;
    return [...posts].sort((a, b) => getPersonalScore(b) - getPersonalScore(a));
  }, [isProfileLoaded, getPersonalScore]);

  const pushToHistory = useCallback((post: SocialPost) => {
    setHistory(prev => [post, ...prev.filter(p => p.id !== post.id)].slice(0, HISTORY_MAX));
  }, []);

  const startDisplayTimer = useCallback((post: SocialPost) => {
    clearDisplayTimer();
    const duration = DISPLAY_DURATIONS[getMediaCategory(post.mediaType)];
    if (duration > 0 && isContinuousRef.current) {
      displayTimerRef.current = setTimeout(() => {
        const q = queueRef.current; const id = activePostIdRef.current;
        if (q.length <= 1) return;
        const idx = q.findIndex(p => p.id === id);
        const next = q[idx === -1 ? 0 : (idx + 1) % q.length];
        if (next) { setActivePostId(next.id); setActivePostState(next); pushToHistory(next); }
      }, duration);
    }
  }, [clearDisplayTimer, pushToHistory]);

  const setActivePost = useCallback((post: SocialPost | null) => {
    if (!post) { if (activePostIdRef.current) { clearDisplayTimer(); setActivePostId(null); setActivePostState(null); } return; }
    if (activePostIdRef.current === post.id) return;
    clearDisplayTimer(); setActivePostId(post.id); setActivePostState(post); pushToHistory(post);
    rebuildQueue(post, allPostsRef.current, activeMoodRef.current);
    startDisplayTimer(post);
  }, [rebuildQueue, pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const setActiveMood = useCallback((mood: VibeMood) => {
    setActiveMoodState(mood); const cur = activePostRef.current;
    if (cur) rebuildQueue(cur, allPostsRef.current, mood);
  }, [rebuildQueue]);

  const playNext = useCallback(() => {
    const q = queueRef.current; const id = activePostIdRef.current;
    if (q.length <= 1) return;
    const idx = q.findIndex(p => p.id === id);
    const next = q[idx === -1 ? 0 : (idx + 1) % q.length];
    if (next) { clearDisplayTimer(); setActivePostId(next.id); setActivePostState(next); pushToHistory(next); startDisplayTimer(next); }
  }, [pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const playPrev = useCallback(() => {
    setHistory(prev => {
      if (prev.length < 2) return prev;
      const prevPost = prev[1]; clearDisplayTimer();
      setActivePostId(prevPost.id); setActivePostState(prevPost);
      rebuildQueue(prevPost, allPostsRef.current, activeMoodRef.current);
      startDisplayTimer(prevPost); return prev.slice(1);
    });
  }, [rebuildQueue, clearDisplayTimer, startDisplayTimer]);

  const addToQueue = useCallback((posts: SocialPost[]) => {
    setAllPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const incoming = posts.filter(p => !existingIds.has(p.id));
      if (incoming.length === 0) return prev;
      let merged = [...prev, ...incoming];
      if (merged.length > MAX_POOL_SIZE) merged = merged.slice(-MAX_POOL_SIZE);
      const cur = activePostRef.current; if (cur && isContinuousRef.current) rebuildQueue(cur, merged, activeMoodRef.current);
      return merged;
    });
    setQueue(prev => prev.length > 0 ? prev : [...posts]);
  }, [rebuildQueue]);

  const sendReaction = useCallback((emoji: VibeReaction, post: SocialPost) => {
    setReactionCounts(prev => {
      const counts = prev[post.id] || { '🔥': 0, '🌊': 0, '💎': 0, '👑': 0, '⚡': 0 };
      return { ...prev, [post.id]: { ...counts, [emoji]: counts[emoji] + 1 } };
    });
    recordSignal(post, 'reaction'); if (firestore) recordEngagement(firestore, post.id, 'like', post.authorId, post.createdAt);
    const burst: ReactionBurst = { id: `${Date.now()}-${Math.random()}`, emoji, x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 };
    setReactionBursts(prev => [...prev, burst]); setTimeout(() => setReactionBursts(p => p.filter(b => b.id !== burst.id)), 1200);
  }, [recordSignal, firestore]);

  return (
    <VibePlayerContext.Provider value={{
      activePostId, activePost, queue, upNext, isContinuous, isLoadingQueue, setActivePost, setIsContinuous, playNext, playPrev, addToQueue,
      activeMood, setActiveMood, history, clearHistory: () => setHistory([]), reactionBursts, sendReaction, reactionCounts,
      isMiniPlayerVisible, sortFeedByProfile, isProfileLoaded, recordPlay, recordWatchedToEnd, recordLike, recordUnlike, recordLikeSignal: recordLike, recordSkip,
    }}>
      {children}
    </VibePlayerContext.Provider>
  );
}

export const useVibePlayer = () => {
  const context = useContext(VibePlayerContext);
  if (!context) throw new Error('useVibePlayer must be used within a VibePlayerProvider');
  return context;
};
