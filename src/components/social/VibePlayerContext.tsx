'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import type { SocialPost } from '@/lib/types';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { useAuth } from '@/hooks/use-auth';
import { useVibeProfile, SignalType } from '@/hooks/use-vibe-profile';

// ─── MEDIA TYPE HELPERS ───────────────────────────────────────────────────────
export type MediaCategory = 'video' | 'image' | 'text';

export function getMediaCategory(mediaType: SocialPost['mediaType']): MediaCategory {
  if (mediaType === 'youtube' || mediaType === 'video' || mediaType === 'tiktok') return 'video';
  if (mediaType === 'image') return 'image';
  return 'text';
}

export function getMediaLabel(mediaType: SocialPost['mediaType']): string {
  const map: Record<string, string> = {
    youtube: 'YouTube',
    video: 'Video',
    tiktok: 'TikTok',
    image: 'Photo',
    text: 'Post',
  };
  return map[mediaType || 'text'] ?? 'Vibe';
}

export const DISPLAY_DURATIONS: Record<MediaCategory, number> = {
  video: 0,
  image: 8000,
  text: 6000,
};

// ─── MOOD SYSTEM ──────────────────────────────────────────────────────────────
export type VibeMood = 'all' | 'hype' | 'chill' | 'study' | 'flex';

export const VIBE_MOODS: { id: VibeMood; label: string; emoji: string; tags: string[] }[] = [
  { id: 'all',   label: 'All Vibes', emoji: '🎵', tags: [] },
  { id: 'hype',  label: 'Hype',      emoji: '🔥', tags: ['hype', 'lit', 'turnt', 'party', 'energy', 'afrobeats', 'amapiano'] },
  { id: 'chill', label: 'Chill',     emoji: '🌊', tags: ['chill', 'relax', 'lofi', 'vibes', 'smooth', 'afrosoul', 'rnb'] },
  { id: 'study', label: 'Study',     emoji: '📚', tags: ['study', 'focus', 'lofi', 'instrumental', 'calm', 'concentration'] },
  { id: 'flex',  label: 'Flex',      emoji: '💎', tags: ['flex', 'drip', 'swag', 'bars', 'rap', 'afrotrap', 'drill'] },
];

// ─── REACTION SYSTEM ──────────────────────────────────────────────────────────
export type VibeReaction = '🔥' | '🌊' | '💎' | '👑' | '⚡';
export const REACTIONS: VibeReaction[] = ['🔥', '🌊', '💎', '👑', '⚡'];

export interface ReactionBurst {
  id: string;
  emoji: VibeReaction;
  x: number;
  y: number;
}

export interface QueueEntry {
  post: SocialPost;
  score: number;
  reason: string;
}

export const HISTORY_MAX = 20;

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
  recordSignal: (post: SocialPost, signal: SignalType) => void;
  getPersonalScore: (post: SocialPost) => number;
  isProfileLoaded: boolean;
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
  
  const { user } = useAuth();
  const { isProfileLoaded, recordSignal, getPersonalScore, getTopInterests } = useVibeProfile();

  const displayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queueRef = useRef<SocialPost[]>([]);
  const allPostsRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const activePostRef = useRef<SocialPost | null>(null);
  const isContinuousRef = useRef(false);
  const activeMoodRef = useRef<VibeMood>('all');

  React.useEffect(() => { queueRef.current = queue; }, [queue]);
  React.useEffect(() => { allPostsRef.current = allPosts; }, [allPosts]);
  React.useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  React.useEffect(() => { activePostRef.current = activePost; }, [activePost]);
  React.useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);
  React.useEffect(() => { activeMoodRef.current = activeMood; }, [activeMood]);

  const isMiniPlayerVisible = !!activePostId;

  const clearDisplayTimer = useCallback(() => {
    if (displayTimerRef.current) {
      clearTimeout(displayTimerRef.current);
      displayTimerRef.current = null;
    }
  }, []);

  // ── SCORE ENGINE: Combined Similarity + Persistence ─────────────────────────
  const computeVibeScore = useCallback((current: SocialPost, candidate: SocialPost): number => {
    let score = 0;

    // 1. Tags (10 pts per overlap)
    const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
    const sharedTags = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
    score += sharedTags.length * 10;

    // 2. Media Category (8 pts)
    if (getMediaCategory(candidate.mediaType) === getMediaCategory(current.mediaType)) {
      score += 8;
      if (candidate.mediaType === current.mediaType) score += 7;
    }

    // 3. Persistence Layer (+50% personal multiplier)
    const personalScore = getPersonalScore(candidate);
    score += personalScore * 0.5;

    // 4. Momentum & Recency
    score += Math.min((candidate.likes || 0) / 5, 12);
    if (candidate.createdAt) {
      const ageDays = (Date.now() - new Date(candidate.createdAt).getTime()) / 86_400_000;
      if (ageDays < 7) score += Math.max(0, 5 - ageDays);
    }

    return score;
  }, [getPersonalScore]);

  const buildReason = useCallback((current: SocialPost, candidate: SocialPost): string => {
    const parts: string[] = [];
    const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
    const shared = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));

    if (shared.length > 0) parts.push(`#${shared[0]}`);
    
    // Check if persistence influenced this
    if (getPersonalScore(candidate) > 30) {
      parts.push('Matches Your Taste');
    } else if (candidate.campusId === current.campusId) {
      parts.push('Same Campus');
    }
    
    if (parts.length === 0) parts.push(getMediaLabel(candidate.mediaType));
    return parts.slice(0, 2).join(' · ');
  }, [getPersonalScore]);

  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[], mood: VibeMood) => {
    setIsLoadingQueue(true);
    const candidates = pool.filter(p => p.id !== current.id);

    let sorted = candidates;
    if (mood !== 'all') {
      const moodTagSet = new Set(VIBE_MOODS.find(m => m.id === mood)!.tags);
      sorted = [...candidates].sort((a, b) => {
        const aMatch = (a.tags || []).some(t => moodTagSet.has(t.toLowerCase())) ? 1 : 0;
        const bMatch = (b.tags || []).some(t => moodTagSet.has(t.toLowerCase())) ? 1 : 0;
        return bMatch - aMatch;
      });
    }

    const localRanked = sorted
      .map(p => ({ post: p, score: computeVibeScore(current, p) }))
      .sort((a, b) => b.score - a.score);

    const rankedPosts = localRanked.map(s => s.post);
    const makeUpNext = (ranked: SocialPost[]): QueueEntry[] =>
      ranked.slice(0, 10).map(p => ({
        post: p,
        score: computeVibeScore(current, p),
        reason: buildReason(current, p),
      }));

    setQueue([current, ...rankedPosts]);
    setUpNext(makeUpNext(rankedPosts));
    setIsLoadingQueue(false);

    try {
      const availablePosts = rankedPosts.slice(0, 20).map(p => ({
        id: p.id, content: p.content, tags: p.tags || [],
      }));
      const recommendation = await getRecommendedVibes({
        currentPostContent: current.content,
        userInterests: getTopInterests(8), // Use dynamic taste, not stale signup interests
        availablePosts,
      });
      const aiIds = recommendation.recommendedPostIds;
      const aiPosts = aiIds
        .map(id => pool.find(p => p.id === id))
        .filter((p): p is SocialPost => !!p && p.id !== current.id);
      
      const aiIdSet = new Set(aiIds);
      const remainingLocal = rankedPosts.filter(p => !aiIdSet.has(p.id));
      const finalRanked = [...aiPosts, ...remainingLocal];
      setQueue([current, ...finalRanked]);
      setUpNext(makeUpNext(finalRanked));
    } catch (err) {
      console.warn('AI matcher unavailable:', err);
    }
  }, [computeVibeScore, buildReason, getTopInterests]);

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
          setActivePostId(nextPost.id);
          setActivePostState(nextPost);
          pushToHistory(nextPost);
        }
      }, duration);
    }
  }, [clearDisplayTimer, pushToHistory]);

  const setActivePost = useCallback((post: SocialPost | null) => {
    clearDisplayTimer();
    if (!post) {
      setActivePostId(null);
      setActivePostState(null);
      return;
    }
    setActivePostId(post.id);
    setActivePostState(post);
    pushToHistory(post);
    rebuildQueue(post, allPostsRef.current, activeMoodRef.current);
    startDisplayTimer(post);
  }, [rebuildQueue, pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const setActiveMood = useCallback((mood: VibeMood) => {
    setActiveMoodState(mood);
    const current = activePostRef.current;
    if (current) rebuildQueue(current, allPostsRef.current, mood);
  }, [rebuildQueue]);

  const playNext = useCallback(() => {
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
  }, [pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const playPrev = useCallback(() => {
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
  }, [rebuildQueue, clearDisplayTimer, startDisplayTimer]);

  const addToQueue = useCallback((posts: SocialPost[]) => {
    setAllPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const incoming = posts.filter(p => !existingIds.has(p.id));
      if (incoming.length === 0) return prev;
      const merged = [...prev, ...incoming];
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
    const postId = activePostIdRef.current;
    if (!postId) return;
    
    // Record persistence signal
    recordSignal(post, 'reaction');

    setReactionCounts(prev => {
      const postCounts = prev[postId] || { '🔥': 0, '🌊': 0, '💎': 0, '👑': 0, '⚡': 0 };
      return { ...prev, [postId]: { ...postCounts, [emoji]: postCounts[emoji] + 1 } };
    });
    const burst: ReactionBurst = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
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
      recordSignal, getPersonalScore, isProfileLoaded
    }}>
      {children}
    </VibePlayerContext.Provider>
  );
}

export const useVibePlayer = () => {
  const context = useContext(VibePlayerContext);
  if (!context) throw new Error('useVibePlayer must be used within VibePlayerProvider');
  return context;
};