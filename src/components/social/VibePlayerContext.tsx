
'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { SocialPost } from '@/lib/types';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { useAuth } from '@/hooks/use-auth';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { recordEngagement } from '@/lib/trending-service';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getRelatedHashtags } from '@/lib/hashtag-utils';

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

export function rankByEmbedding(posts: SocialPost[], userVector: number[]) {
  if (!userVector) return posts;
  return posts
    .filter(p => p.embedding)
    .map(p => ({ post: p, score: cosineSimilarity(userVector, p.embedding!) }))
    .sort((a, b) => b.score - a.score)
    .map(r => r.post);
}

export function computeBaseScore(
  current: SocialPost, 
  candidate: SocialPost, 
  viralTags: Set<string> = new Set(),
  trendingTags: Set<string> = new Set(),
  relatedGraphTags: Set<string> = new Set() 
) {
  let score = 0;
  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const sharedTags = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
  score += sharedTags.length * 10;
  
  const candidateTags = (candidate.tags || []).map(t => t.toLowerCase());
  const relatedMatches = candidateTags.filter(t => relatedGraphTags.has(t));
  score += relatedMatches.length * 5;
  
  if (candidateTags.some(t => viralTags.has(t))) score += 25;
  else if (candidateTags.some(t => trendingTags.has(t))) score += 12;

  const currentCat = getMediaCategory(current.mediaType);
  const candidateCat = getMediaCategory(candidate.mediaType);
  if (currentCat === candidateCat) score += 8;

  if (candidate.campusId === current.campusId) score += 10;
  score += explorationBoost(candidate);

  if (candidate.createdAt) {
    const date = typeof candidate.createdAt === 'string' ? new Date(candidate.createdAt) : (candidate.createdAt.toDate ? candidate.createdAt.toDate() : new Date(candidate.createdAt));
    score += exponentialFreshness(date);
  }
  return score;
}

export function computeVibeScore(
  current: SocialPost, 
  candidate: SocialPost, 
  getPersonalScore: (p: SocialPost) => number,
  viralTags: Set<string>, 
  trendingTags: Set<string>, 
  relatedTags: Set<string>,
  creatorReputation: Record<string, number> = {}
) {
  const base = computeBaseScore(current, candidate, viralTags, trendingTags, relatedTags);
  const personal = getPersonalScore(candidate);
  
  // ELITE UPGRADE: Factor in Creator Reputation (Quality Score)
  const creatorQuality = creatorReputation[candidate.authorId] || 50;
  const reputationBoost = (creatorQuality / 100) * 20; // Max +20 points for high quality

  return base * 0.5 + personal * 0.3 + reputationBoost;
}

export function buildSmartQueue(
  current: SocialPost, pool: SocialPost[], mood: VibeMood, getPersonalScore: (p: SocialPost) => number,
  viralTags: Set<string> = new Set(), trendingTags: Set<string> = new Set(), relatedTags: Set<string> = new Set(),
  creatorReputation: Record<string, number> = {}
) {
  const ranked = [];
  const moodDef = VIBE_MOODS.find(m => m.id === mood);
  const moodTagSet = moodDef && mood !== 'all' ? new Set(moodDef.tags) : new Set<string>();

  for (const p of pool) {
    if (p.id === current.id) continue;
    if (moodTagSet.size > 0) {
      const match = (p.tags || []).some(t => moodTagSet.has(t.toLowerCase())) || p.mediaType === 'video';
      if (!match) continue;
    }
    const score = computeVibeScore(current, p, getPersonalScore, viralTags, trendingTags, relatedTags, creatorReputation);
    ranked.push({ post: p, score });
  }
  return ranked.sort((a, b) => b.score - a.score);
}

function buildReason(current: SocialPost, candidate: SocialPost, getPersonalScore: (p: SocialPost) => number, userEmbedding?: number[], relatedTags: Set<string> = new Set()): string {
  const parts: string[] = [];
  if (userEmbedding && candidate.embedding && cosineSimilarity(userEmbedding, candidate.embedding) > 0.88) parts.push('Personal Taste');
  const shared = (candidate.tags || []).filter(t => (current.tags || []).includes(t));
  if (shared.length > 0 && parts.length < 2) parts.push(`#${shared[0]}`);
  const candidateTags = (candidate.tags || []).map(t => t.toLowerCase());
  if (parts.length < 2 && candidateTags.some(t => relatedTags.has(t))) parts.push(`Related: #${candidateTags.find(t => relatedTags.has(t))}`);
  if (parts.length < 2 && getPersonalScore(candidate) > 15) parts.push('Based on history');
  if (parts.length === 0) parts.push('Trending now');
  return parts.slice(0, 2).join(' · ');
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
  recordLike: (post: SocialPost) => void; recordUnlike: (post: SocialPost) => void; recordSkip: (post: SocialPost) => void;
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
  const [viralTags, setViralTags] = useState<Set<string>>(new Set());
  const [trendingTags, setTrendingTags] = useState<Set<string>>(new Set());
  const [creatorReputation, setCreatorReputation] = useState<Record<string, number>>({});
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
  const creatorReputationRef = useRef(creatorReputation);

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
  useEffect(() => { creatorReputationRef.current = creatorReputation; }, [creatorReputation]);

  useEffect(() => {
    if (!firestore) return;
    getDocs(query(collection(firestore, 'hashtags'), orderBy('trendScore', 'desc'), limit(20))).then(snap => {
        const viral = new Set<string>(); const trending = new Set<string>();
        snap.docs.forEach(d => {
            const data = d.data(); const tag = data.tag?.toLowerCase(); if (!tag) return;
            if (data.trendScore > 30) viral.add(tag); else if (data.trendScore > 15) trending.add(tag);
        });
        setViralTags(viral); setTrendingTags(trending);
    });

    // Load top creators to boost their content in the discovery engine
    const q = query(
      collection(firestore, 'creator_reputation'), 
      orderBy('qualityScore', 'desc'), 
      limit(200)
    );
    const unsubRep = onSnapshot(q, (snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach(d => { map[d.id] = d.data().qualityScore; });
      setCreatorReputation(map);
    });
    return () => unsubRep();
  }, [firestore]);

  const recordPlay = useCallback((p: SocialPost) => {
    recordSignal(p, 'play');
    if (firestore) recordEngagement(firestore, p.id, 'view', p.authorId, p.createdAt);
  }, [recordSignal, firestore]);

  const recordWatchedToEnd = useCallback((p: SocialPost) => {
    recordSignal(p, 'watched_to_end');
    if (firestore) recordEngagement(firestore, p.id, 'completion', p.authorId, p.createdAt);
  }, [recordSignal, firestore]);

  const recordLike = useCallback((p: SocialPost) => recordSignal(p, 'like'), [recordSignal]);
  const recordUnlike = useCallback((p: SocialPost) => recordSignal(p, 'unlike'), [recordSignal]);
  const recordSkip = useCallback((p: SocialPost) => recordSignal(p, 'skip'), [recordSignal]);

  const sortFeedByProfile = useCallback((posts: SocialPost[]): SocialPost[] => {
    if (!isProfileLoaded) return posts;
    return [...posts].sort((a, b) => getPersonalScore(b) - getPersonalScore(a));
  }, [isProfileLoaded, getPersonalScore]);

  const clearDisplayTimer = useCallback(() => {
    if (displayTimerRef.current) { clearTimeout(displayTimerRef.current); displayTimerRef.current = null; }
  }, []);

  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[], mood: VibeMood) => {
    setIsLoadingQueue(true);
    const scorer = getPersonalScoreRef.current;
    const userEmbedding = userEmbeddingRef.current;
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
    
    const vectorRanked = userEmbedding ? rankByEmbedding(pool, userEmbedding).slice(0, 140) : pool.slice(0, 140);
    const trendingRanked = pool.filter(p => !vectorRanked.some(v => v.id === p.id)).sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 40);
    const explorationPool = pool.filter(p => !vectorRanked.some(v => v.id === p.id) && !trendingRanked.some(t => t.id === p.id)).sort(() => Math.random() - 0.5).slice(0, 20);
    const blendedPool = [...vectorRanked, ...trendingRanked, ...explorationPool];

    const rankedResults = buildSmartQueue(current, blendedPool, mood, scorer, viral, trending, relatedTags, reputations);
    const finalPoolForNext = rankedResults.map(r => r.post).slice(0, 25);
    
    const makeUpNext = (ranked: SocialPost[]): QueueEntry[] =>
      ranked.slice(0, 15).map(p => ({
        post: p,
        score: computeVibeScore(current, p, scorer, viral, trending, relatedTags, reputations),
        reason: buildReason(current, p, scorer, userEmbedding, relatedTags),
      }));

    setQueue([current, ...finalPoolForNext]);
    setUpNext(makeUpNext(finalPoolForNext));
    setIsLoadingQueue(false);

    try {
      const recommendation = await getRecommendedVibes({
        currentPostContent: current.content,
        userInterests: getTopInterests(10),
        availablePosts: finalPoolForNext.map(p => ({ id: p.id, content: p.content, tags: p.tags || [] })),
      });
      const postMap = new Map<string, SocialPost>(); pool.forEach(p => postMap.set(p.id, p));
      const aiPosts = recommendation.recommendedPostIds.filter(id => postMap.has(id)).map(id => postMap.get(id)!);
      const combined = [...aiPosts, ...finalPoolForNext.filter(p => !recommendation.recommendedPostIds.includes(p.id))];
      setQueue([current, ...combined]); setUpNext(makeUpNext(combined));
    } catch (err) { console.warn('Liaison AI bypassed'); }
  }, [getTopInterests, firestore]);

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
      isMiniPlayerVisible, sortFeedByProfile, isProfileLoaded, recordPlay, recordWatchedToEnd, recordLike, recordUnlike, recordSkip,
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
