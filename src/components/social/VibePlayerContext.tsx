'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { SocialPost } from '@/lib/types';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { useAuth } from '@/hooks/use-auth';
import { useVibeProfile } from '@/hooks/use-vibe-profile';

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
 * 📉 EXPONENTIAL FRESHNESS DECAY
 */
function exponentialFreshness(date: Date) {
  const ageDays = (Date.now() - date.getTime()) / 86400000;
  return 10 * Math.exp(-ageDays / 3);
}

export function computeBaseScore(current: SocialPost, candidate: SocialPost) {
  let score = 0;

  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const sharedTags = (candidate.tags || []).filter(t =>
    currentTags.has(t.toLowerCase())
  );

  score += sharedTags.length * 12;

  const currentCat = getMediaCategory(current.mediaType);
  const candidateCat = getMediaCategory(candidate.mediaType);

  if (currentCat === candidateCat) {
    score += 8;
    if (candidate.mediaType === current.mediaType) score += 7;
  }

  if (candidate.campusId === current.campusId) score += 10;
  else if (candidate.campusId === 'all') score += 5;

  score += Math.min((candidate.likes || 0) / 5, 15);

  if (candidate.createdAt) {
    const date =
      typeof candidate.createdAt === 'string'
        ? new Date(candidate.createdAt)
        : (candidate.createdAt.toDate ? candidate.createdAt.toDate() : new Date(candidate.createdAt));

    score += exponentialFreshness(date);
  }

  return score;
}

export function computeVibeScore(
  current: SocialPost,
  candidate: SocialPost,
  getPersonalScore: (p: SocialPost) => number
) {
  const base = computeBaseScore(current, candidate);
  const personal = getPersonalScore(candidate);

  return base * 0.6 + personal * 0.4;
}

/**
 * 🏎️ MASSIVELY OPTIMIZED SMART QUEUE BUILDER
 */
export function buildSmartQueue(
  current: SocialPost,
  pool: SocialPost[],
  mood: VibeMood,
  getPersonalScore: (p: SocialPost) => number
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

    const score = computeVibeScore(current, p, getPersonalScore);
    ranked.push({ post: p, score });
  }

  ranked.sort((a, b) => b.score - a.score);

  return ranked.map(r => r.post);
}

function buildReason(
  current: SocialPost,
  candidate: SocialPost,
  getPersonalScore: (p: SocialPost) => number
): string {
  const parts: string[] = [];
  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const shared = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
  
  if (shared.length > 0) parts.push(`#${shared[0]}`);
  if (getPersonalScore(candidate) > 15 && parts.length < 2) parts.push('Matched to your profile');
  if (candidate.campusId === current.campusId && parts.length < 2) parts.push('Same Yard');
  if (candidate.authorId === current.authorId && parts.length < 2) parts.push('Creator match');
  
  if (parts.length === 0) parts.push('Trending on GAM Hub');
  return parts.slice(0, 2).join(' · ');
}

export interface QueueEntry { post: SocialPost; score: number; reason: string; }
export const HISTORY_MAX = 30;
export const MAX_POOL_SIZE = 800; // 🛡️ Memory Protection Limit
export const PREFETCH_SIZE = 5;   // 🚀 TikTok Prefetch Size

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
  
  const { recordSignal, getPersonalScore, getTopInterests, isLoaded: isProfileLoaded } = useVibeProfile();

  const displayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<SocialPost[]>([]);
  const allPostsRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const activePostRef = useRef<SocialPost | null>(null);
  const isContinuousRef = useRef(false);
  const activeMoodRef = useRef<VibeMood>('all');
  const getPersonalScoreRef = useRef(getPersonalScore);

  React.useEffect(() => { queueRef.current = queue; }, [queue]);
  React.useEffect(() => { allPostsRef.current = allPosts; }, [allPosts]);
  React.useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  React.useEffect(() => { activePostRef.current = activePost; }, [activePost]);
  React.useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);
  React.useEffect(() => { activeMoodRef.current = activeMood; }, [activeMood]);
  React.useEffect(() => { getPersonalScoreRef.current = getPersonalScore; }, [getPersonalScore]);

  const isMiniPlayerVisible = !!activePostId;

  const recordPlay         = useCallback((p: SocialPost) => recordSignal(p, 'play'),           [recordSignal]);
  const recordWatchedToEnd = useCallback((p: SocialPost) => recordSignal(p, 'watched_to_end'), [recordSignal]);
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

  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[], mood: VibeMood) => {
    setIsLoadingQueue(true);
    const scorer = getPersonalScoreRef.current;
    
    // Stage 1: Local Optimized Retrieval
    const localRanked = buildSmartQueue(current, pool, mood, scorer);
    
    const makeUpNext = (ranked: SocialPost[]): QueueEntry[] =>
      ranked.slice(0, 15).map(p => ({
        post: p,
        score: computeVibeScore(current, p, scorer),
        reason: buildReason(current, p, scorer),
      }));

    setQueue([current, ...localRanked]);
    setUpNext(makeUpNext(localRanked));
    setIsLoadingQueue(false);

    try {
      const eliteCandidates = localRanked.slice(0, 25).map(p => ({
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

      // AI Safety Guard: Filter out any hallucinated IDs
      const safeIds = aiIds.filter(id => postMap.has(id));

      const aiPosts = safeIds
        .map(id => postMap.get(id)!)
        .filter((p) => p.id !== current.id);
      
      const aiIdSet = new Set(safeIds);
      const remainingLocal = localRanked.filter(p => !aiIdSet.has(p.id));
      
      const finalRanked = [...aiPosts, ...remainingLocal];
      
      setQueue([current, ...finalRanked]);
      setUpNext(makeUpNext(finalRanked));

      // 🚀 Stage 3: TikTok-Style Prefetch Engine
      if (typeof window !== 'undefined') {
        const prefetchList = finalRanked.slice(0, PREFETCH_SIZE);
        prefetchList.forEach(p => {
          if (p.mediaType === 'video' && p.mediaUrl) {
            const v = document.createElement('video');
            v.src = p.mediaUrl;
            v.preload = 'auto';
          } else if (p.mediaType === 'image' && p.imageUrl) {
            const img = new Image();
            img.src = p.imageUrl;
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
      
      // 🛡️ MEMORY PROTECTION: Eject oldest items if we exceed 800
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
    const burst: ReactionBurst = {
      id: `${Date.now()}-${Math.random()}`, emoji,
      x: 20 + Math.random() * 60, y: 20 + Math.random() * 60,
    };
    setReactionBursts(prev => [...prev, burst]);
    setTimeout(() => setReactionBursts(prev => prev.filter(b => b.id !== burst.id)), 1200);
  }, [recordSignal]);

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
