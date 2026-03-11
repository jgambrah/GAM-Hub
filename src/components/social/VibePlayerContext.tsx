'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { SocialPost } from '@/lib/types';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { useAuth } from '@/hooks/use-auth';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { recordEngagement } from '@/lib/trending-service';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';

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

/**
 * 📐 COSINE SIMILARITY ENGINE
 */
export function cosineSimilarity(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * 📉 EXPONENTIAL FRESHNESS DECAY
 */
function exponentialFreshness(date: Date) {
  const ageHours = (Date.now() - date.getTime()) / 3600000;
  return 10 * Math.exp(-ageHours / 3);
}

/**
 * 🚀 EXPLORATION BOOST (Multi-Armed Bandit)
 */
export function explorationBoost(post: SocialPost) {
  const views = post.likes || 0; 
  if (views < 50) return 15;
  if (views < 200) return 8;
  if (views < 500) return 3;
  return 0;
}

/**
 * 🏗️ PIPELINE STAGE 1: VECTOR RANKER (THE NET)
 */
export function rankByEmbedding(posts: SocialPost[], userVector: number[]) {
  if (!userVector) return posts;
  const ranked = posts
    .filter(p => p.embedding)
    .map(p => ({
      post: p,
      score: cosineSimilarity(userVector, p.embedding!)
    }))
    .sort((a, b) => b.score - a.score);

  return ranked.map(r => r.post);
}

/**
 * 🏎️ PIPELINE STAGE 2: LOCAL CONTEXT RANKING (THE VIBE)
 */
export function computeBaseScore(
  current: SocialPost, 
  candidate: SocialPost, 
  viralTags: Set<string> = new Set(),
  trendingTags: Set<string> = new Set()
) {
  let score = 0;

  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const sharedTags = (candidate.tags || []).filter(t =>
    currentTags.has(t.toLowerCase())
  );
  
  // 🏷️ HASHTAG SIGNAL: Boost shared tags
  score += sharedTags.length * 10;
  
  // 🚀 LIAISON VIRAL BOOST ENGINE
  const candidateTags = (candidate.tags || []).map(t => t.toLowerCase());
  
  // 1. Viral Boost (+25): Top priority for exploding narratives
  if (candidateTags.some(t => viralTags.has(t))) {
    score += 25;
  }
  // 2. Trending Boost (+12): High weight for rising topics
  else if (candidateTags.some(t => trendingTags.has(t))) {
    score += 12;
  }

  const currentCat = getMediaCategory(current.mediaType);
  const candidateCat = getMediaCategory(candidate.mediaType);

  if (currentCat === candidateCat) {
    score += 8;
    if (candidate.mediaType === current.mediaType) score += 7;
  }

  if (candidate.campusId === current.campusId) score += 10;
  else if (candidate.campusId === 'all') score += 5;

  score += Math.min((candidate.likes || 0) / 5, 15);

  // Apply Bandit Entropy Boost (Testing new content)
  score += explorationBoost(candidate);

  if (candidate.createdAt) {
    const date = typeof candidate.createdAt === 'string'
        ? new Date(candidate.createdAt)
        : (candidate.createdAt.toDate ? candidate.createdAt.toDate() : new Date(candidate.createdAt));
    score += exponentialFreshness(date);
  }

  return score;
}

export function computeVibeScore(
  current: SocialPost,
  candidate: SocialPost,
  getPersonalScore: (p: SocialPost) => number,
  viralTags: Set<string> = new Set(),
  trendingTags: Set<string> = new Set()
) {
  const base = computeBaseScore(current, candidate, viralTags, trendingTags);
  const personal = getPersonalScore(candidate);

  return base * 0.6 + personal * 0.4;
}

export function buildSmartQueue(
  current: SocialPost,
  pool: SocialPost[],
  mood: VibeMood,
  getPersonalScore: (p: SocialPost) => number,
  viralTags: Set<string> = new Set(),
  trendingTags: Set<string> = new Set()
) {
  const ranked = [];
  const moodDef = VIBE_MOODS.find(m => m.id === mood);
  const moodTagSet = moodDef && mood !== 'all' ? new Set(moodDef.tags) : new Set<string>();

  for (const p of pool) {
    if (p.id === current.id) continue;

    if (moodTagSet.size > 0) {
      const match =
        (p.tags || []).some(t => moodTagSet.has(t.toLowerCase())) ||
        p.mediaType === 'video' || p.mediaType === 'youtube' || p.mediaType === 'tiktok';

      if (!match) continue;
    }

    const score = computeVibeScore(current, p, getPersonalScore, viralTags, trendingTags);
    ranked.push({ post: p, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function buildReason(
  current: SocialPost,
  candidate: SocialPost,
  getPersonalScore: (p: SocialPost) => number,
  userEmbedding?: number[]
): string {
  const parts: string[] = [];
  
  if (userEmbedding && candidate.embedding) {
      const tasteSimilarity = cosineSimilarity(userEmbedding, candidate.embedding);
      if (tasteSimilarity > 0.88) parts.push('Vibe taste match');
  }

  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const shared = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
  
  if (shared.length > 0 && parts.length < 2) parts.push(`#${shared[0]}`);
  if (getPersonalScore(candidate) > 15 && parts.length < 2) parts.push('Based on your history');
  
  // Multi-Armed Bandit Label
  if (explorationBoost(candidate) > 5 && parts.length === 0) parts.push('Fresh Discovery');

  if (parts.length === 0) parts.push('Trending on GAM Hub');
  return parts.slice(0, 2).join(' · ');
}

export interface QueueEntry { post: SocialPost; score: number; reason: string; }
export const HISTORY_MAX = 30;
export const MAX_POOL_SIZE = 800; 
export const PREFETCH_SIZE = 5;   

interface VibePlayerContextType {
  activePostId: string | null;
  activePost: SocialPost | null;
  queue: SocialPost[];
  upNext: QueueEntry[];
  isContinuous: boolean;
  isLoadingQueue: boolean;
  setActivePost: (post: SocialPost | null) => void;
  setIsContinuous: (val: boolean) => void;
  playNext: () => void;
  playPrev: () => void;
  addToQueue: (posts: SocialPost[]) => void;
  activeMood: VibeMood;
  setActiveMood: (mood: VibeMood) => void;
  history: SocialPost[];
  clearHistory: () => void;
  reactionBursts: ReactionBurst[];
  sendReaction: (emoji: VibeReaction, post: SocialPost) => void;
  reactionCounts: Record<string, Record<VibeReaction, number>>;
  isMiniPlayerVisible: boolean;
  sortFeedByProfile: (posts: SocialPost[]) => SocialPost[];
  isProfileLoaded: boolean;
  recordPlay: (post: SocialPost) => void;
  recordWatchedToEnd: (post: SocialPost) => void;
  recordLike: (post: SocialPost) => void;
  recordUnlike: (post: SocialPost) => void;
  recordSkip: (post: SocialPost) => void;
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
  
  // 🛰️ LIAISON VIRAL TRACKERS
  const [viralTags, setViralTags] = useState<Set<string>>(new Set());
  const [trendingTags, setTrendingTags] = useState<Set<string>>(new Set());
  
  const { profile, recordSignal, getPersonalScore, getTopInterests, isLoaded: isProfileLoaded } = useVibeProfile();

  const displayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<SocialPost[]>([]);
  const allPostsRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const activePostRef = useRef<SocialPost | null>(null);
  const isContinuousRef = useRef(false);
  const activeMoodRef = useRef<VibeMood>('all');
  const getPersonalScoreRef = useRef(getPersonalScore);
  const userEmbeddingRef = useRef(profile.vibeEmbedding);
  
  const viralTagsRef = useRef(viralTags);
  const trendingTagsRef = useRef(trendingTags);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { allPostsRef.current = allPosts; }, [allPosts]);
  useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  useEffect(() => { activePostRef.current = activePost; }, [activePost]);
  useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);
  useEffect(() => { activeMoodRef.current = activeMood; }, [activeMood]);
  useEffect(() => { getPersonalScoreRef.current = getPersonalScore; }, [getPersonalScore]);
  useEffect(() => { userEmbeddingRef.current = profile.vibeEmbedding; }, [profile.vibeEmbedding]);
  
  useEffect(() => { viralTagsRef.current = viralTags; }, [viralTags]);
  useEffect(() => { trendingTagsRef.current = trendingTags; }, [trendingTags]);

  const isMiniPlayerVisible = !!activePostId;

  // 🛰️ LIAISON CONTEXT: Fetch viral and trending tags for discovery boost
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, 'hashtags'), orderBy('trendScore', 'desc'), limit(20));
    getDocs(q).then(snap => {
        const viral = new Set<string>();
        const trending = new Set<string>();
        snap.docs.forEach(d => {
            const data = d.data();
            const tag = data.tag?.toLowerCase();
            if (!tag) return;
            if (data.trendScore > 30) viral.add(tag);
            else if (data.trendScore > 15) trending.add(tag);
        });
        setViralTags(viral);
        setTrendingTags(trending);
    });
  }, [firestore]);

  const recordPlay = useCallback((p: SocialPost) => {
    recordSignal(p, 'play');
    if (firestore) recordEngagement(firestore, p.id, 'view', p.createdAt);
  }, [recordSignal, firestore]);

  const recordWatchedToEnd = useCallback((p: SocialPost) => {
    recordSignal(p, 'watched_to_end');
    if (firestore) recordEngagement(firestore, p.id, 'completion', p.createdAt);
  }, [recordSignal, firestore]);

  const recordLike         = useCallback((p: SocialPost) => recordSignal(p, 'like'),           [recordSignal]);
  const recordUnlike       = useCallback((p: SocialPost) => recordSignal(p, 'unlike'),         [recordSignal]);
  const recordSkip         = useCallback((p: SocialPost) => recordSignal(p, 'skip'),           [recordSignal]);

  const sortFeedByProfile = useCallback((posts: SocialPost[]): SocialPost[] => {
    if (!isProfileLoaded) return posts;
    return [...posts].sort((a, b) => getPersonalScore(b) - getPersonalScore(a));
  }, [isProfileLoaded, getPersonalScore]);

  const clearDisplayTimer = useCallback(() => {
    if (displayTimerRef.current) { clearTimeout(displayTimerRef.current); displayTimerRef.current = null; }
  }, []);

  /**
   * 🏗️ THE MULTI-ARMED BANDIT PIPELINE
   */
  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[], mood: VibeMood) => {
    setIsLoadingQueue(true);
    const scorer = getPersonalScoreRef.current;
    const userEmbedding = userEmbeddingRef.current;
    
    const viral = viralTagsRef.current;
    const trending = trendingTagsRef.current;
    
    // STAGE 1: BLENDED CANDIDATE SELECTION
    const vectorRanked = userEmbedding 
        ? rankByEmbedding(pool, userEmbedding).slice(0, 140) 
        : pool.slice(0, 140);

    const trendingRanked = pool
        .filter(p => !vectorRanked.some(v => v.id === p.id))
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 40);

    const explorationPool = pool
        .filter(p => !vectorRanked.some(v => v.id === p.id) && !trendingRanked.some(t => t.id === p.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, 20);

    const blendedPool = [...vectorRanked, ...trendingRanked, ...explorationPool];

    // STAGE 2: Local Vibe Contextual Ranking
    const rankedResults = buildSmartQueue(current, blendedPool, mood, scorer, viral, trending);
    
    // 🛡️ LIAISON DIVERSITY PROTOCOL: Prevent creator repetition
    const authorSeen = new Set<string>();
    const diverseRanked: SocialPost[] = [];
    for (const entry of rankedResults) {
      if (entry.post.authorId && !authorSeen.has(entry.post.authorId)) {
        diverseRanked.push(entry.post);
        authorSeen.add(entry.post.authorId);
      }
      if (diverseRanked.length >= 25) break; 
    }

    const finalPoolForNext = diverseRanked.length > 0 ? diverseRanked : rankedResults.map(r => r.post);
    
    const makeUpNext = (ranked: SocialPost[]): QueueEntry[] =>
      ranked.slice(0, 15).map(p => ({
        post: p,
        score: computeVibeScore(current, p, scorer, viral, trending),
        reason: buildReason(current, p, scorer, userEmbedding),
      }));

    setQueue([current, ...finalPoolForNext]);
    setUpNext(makeUpNext(finalPoolForNext));
    setIsLoadingQueue(false);

    try {
      // STAGE 3: AI Re-Ranking
      const eliteCandidates = finalPoolForNext.slice(0, 25).map(p => ({
        id: p.id, 
        content: p.content, 
        tags: p.tags || [],
      }));

      const recommendation = await getRecommendedVibes({
        currentPostContent: current.content,
        userInterests: getTopInterests(10),
        availablePosts: eliteCandidates,
      });

      const aiIds = recommendation.recommendedPostIds;
      const postMap = new Map<string, SocialPost>();
      for (const p of pool) postMap.set(p.id, p);

      const safeIds = aiIds.filter(id => postMap.has(id));
      const aiPosts = safeIds.map(id => postMap.get(id)!).filter((p) => p.id !== current.id);
      
      const aiIdSet = new Set(safeIds);
      const remainingDiverse = finalPoolForNext.filter(p => !aiIdSet.has(p.id));
      const finalRanked = [...aiPosts, ...remainingDiverse];
      
      setQueue([current, ...finalRanked]);
      setUpNext(makeUpNext(finalRanked));

      // TikTok Prefetch
      if (typeof window !== 'undefined') {
        finalRanked.slice(0, PREFETCH_SIZE).forEach(p => {
          if (getMediaCategory(p.mediaType) === 'video' && p.mediaUrl) {
            const v = document.createElement('video');
            v.src = p.mediaUrl;
            v.preload = 'auto';
          }
        });
      }

    } catch (err) {
      console.warn('Liaison Re-ranking AI bypassed:', err);
    }
  }, [getTopInterests]);

  const pushToHistory = useCallback((post: SocialPost) => {
    setHistory(prev => {
      const filtered = prev.filter(p => p.id !== post.id);
      return [post, ...filtered].slice(0, HISTORY_MAX);
    });
  }, []);

  const startDisplayTimer = useCallback((post: SocialPost) => {
    clearDisplayTimer();
    const cat = getMediaCategory(post.mediaType);
    const duration = DISPLAY_DURATIONS[cat];
    if (duration > 0 && isContinuousRef.current) {
      displayTimerRef.current = setTimeout(() => {
        const currentQueue = queueRef.current;
        const currentId = activePostIdRef.current;
        if (currentQueue.length <= 1) return;
        const idx = currentQueue.findIndex(p => p.id === currentId);
        const nextPost = currentQueue[idx === -1 ? 0 : (idx + 1) % currentQueue.length];
        if (nextPost) {
          setTimeout(() => {
            setActivePostId(nextPost.id);
            setActivePostState(nextPost);
            pushToHistory(nextPost);
          }, 0);
        }
      }, duration);
    }
  }, [clearDisplayTimer, pushToHistory]);

  const setActivePost = useCallback((post: SocialPost | null) => {
    setTimeout(() => {
      if (!post) { 
        if (activePostIdRef.current !== null) {
          clearDisplayTimer();
          setActivePostId(null); 
          setActivePostState(null); 
        }
        return; 
      }
      
      if (activePostIdRef.current === post.id) return;
      
      clearDisplayTimer();
      setActivePostId(post.id);
      setActivePostState(post);
      pushToHistory(post);
      rebuildQueue(post, allPostsRef.current, activeMoodRef.current);
      startDisplayTimer(post);
    }, 0);
  }, [rebuildQueue, pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const setActiveMood = useCallback((mood: VibeMood) => {
    setActiveMoodState(mood);
    const current = activePostRef.current;
    if (current) rebuildQueue(current, allPostsRef.current, mood);
  }, [rebuildQueue]);

  const playNext = useCallback(() => {
    setTimeout(() => {
      const currentQueue = queueRef.current;
      const currentId = activePostIdRef.current;
      if (currentQueue.length <= 1) return;
      const idx = currentQueue.findIndex(p => p.id === currentId);
      const nextPost = currentQueue[idx === -1 ? 0 : (idx + 1) % currentQueue.length];
      if (nextPost) {
        clearDisplayTimer();
        setActivePostId(nextPost.id);
        setActivePostState(nextPost);
        pushToHistory(nextPost);
        startDisplayTimer(nextPost);
      }
    }, 0);
  }, [pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const playPrev = useCallback(() => {
    setTimeout(() => {
      setHistory(prev => {
        if (prev.length < 2) return prev;
        const prevPost = prev[1];
        clearDisplayTimer();
        setActivePostId(prevPost.id);
        setActivePostState(prevPost);
        rebuildQueue(prevPost, allPostsRef.current, activeMoodRef.current);
        startDisplayTimer(prevPost);
        return prev.slice(1);
      });
    }, 0);
  }, [rebuildQueue, clearDisplayTimer, startDisplayTimer]);

  const addToQueue = useCallback((posts: SocialPost[]) => {
    setAllPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const incoming = posts.filter(p => !existingIds.has(p.id));
      if (incoming.length === 0) return prev;
      
      let merged = [...prev, ...incoming];
      if (merged.length > MAX_POOL_SIZE) {
        merged = merged.slice(-MAX_POOL_SIZE);
      }

      const currentPost = activePostRef.current;
      if (currentPost && isContinuousRef.current) {
        setTimeout(() => rebuildQueue(currentPost, merged, activeMoodRef.current), 0);
      }
      return merged;
    });
    setQueue(prev => {
      if (prev.length > 0) return prev;
      return [...posts];
    });
  }, [rebuildQueue]);

  const sendReaction = useCallback((emoji: VibeReaction, post: SocialPost) => {
    const postId = post.id;
    setReactionCounts(prev => {
      const postCounts = prev[postId] || { '🔥': 0, '🌊': 0, '💎': 0, '👑': 0, '⚡': 0 };
      return { ...prev, [postId]: { ...postCounts, [emoji]: postCounts[emoji] + 1 } };
    });
    recordSignal(post, 'reaction');
    if (firestore) recordEngagement(firestore, post.id, 'like', post.createdAt);
    const burst: ReactionBurst = {
      id: `${Date.now()}-${Math.random()}`, emoji,
      x: 20 + Math.random() * 60, y: 20 + Math.random() * 60,
    };
    setReactionBursts(prev => [...prev, burst]);
    setTimeout(() => setReactionBursts(prev => prev.filter(b => b.id !== burst.id)), 1200);
  }, [recordSignal, firestore]);

  const clearHistory = useCallback(() => setHistory([]), []);
  React.useEffect(() => () => clearDisplayTimer(), [clearDisplayTimer]);

  return (
    <VibePlayerContext.Provider value={{
      activePostId, activePost, queue, upNext,
      isContinuous, isLoadingQueue,
      setActivePost, setIsContinuous, playNext, playPrev, addToQueue,
      activeMood, setActiveMood,
      history, clearHistory,
      reactionBursts, sendReaction, reactionCounts,
      isMiniPlayerVisible,
      sortFeedByProfile, isProfileLoaded,
      recordPlay, recordWatchedToEnd, recordLike, recordUnlike,
      recordSkip,
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
