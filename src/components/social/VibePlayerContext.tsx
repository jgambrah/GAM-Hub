'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { SocialPost } from '@/lib/types';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { useAuth } from '@/hooks/use-auth';

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
  x: number;   // 0-100 % from left
  y: number;   // 0-100 % from top
}

// ─── SIMILARITY ENGINE ────────────────────────────────────────────────────────
function computeVibeScore(current: SocialPost, candidate: SocialPost, mood: VibeMood): number {
  let score = 0;

  // 1. Tag overlap (up to 50 pts)
  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const sharedTags = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
  score += sharedTags.length * 10;

  // 2. Mood Boost (30 pts)
  if (mood !== 'all') {
    const moodDef = VIBE_MOODS.find(m => m.id === mood)!;
    const moodTagSet = new Set(moodDef.tags);
    if ((candidate.tags || []).some(t => moodTagSet.has(t.toLowerCase()))) {
      score += 30;
    }
  }

  // 3. Same media type (15 pts)
  if (candidate.mediaType === current.mediaType) score += 15;

  // 4. Same campus (10 pts)
  if (candidate.campusId === current.campusId) score += 10;

  return score;
}

function buildSmartQueue(current: SocialPost, pool: SocialPost[], mood: VibeMood): SocialPost[] {
  const candidates = pool.filter(
    p => p.id !== current.id &&
      (p.mediaType === 'youtube' || p.mediaType === 'video' || p.mediaType === 'tiktok')
  );

  return candidates
    .map(p => ({ post: p, score: computeVibeScore(current, p, mood) }))
    .sort((a, b) => b.score - a.score)
    .map(s => s.post);
}

function buildReason(current: SocialPost, candidate: SocialPost, mood: VibeMood): string {
  const parts: string[] = [];
  if (mood !== 'all') {
    const moodDef = VIBE_MOODS.find(m => m.id === mood)!;
    const moodTagSet = new Set(moodDef.tags);
    if ((candidate.tags || []).some(t => moodTagSet.has(t.toLowerCase()))) {
      parts.push(`${moodDef.emoji} ${moodDef.label} vibe`);
    }
  }
  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const shared = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
  if (shared.length > 0) parts.push(`#${shared[0]}`);
  if (parts.length === 0) parts.push('Trending on the Yard');
  return parts.slice(0, 2).join(' · ');
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
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
  sendReaction: (emoji: VibeReaction) => void;
  reactionCounts: Record<string, Record<VibeReaction, number>>;
  isMiniPlayerVisible: boolean;
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

  const queueRef = useRef<SocialPost[]>([]);
  const allPostsRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const isContinuousRef = useRef(false);
  const activeMoodRef = useRef<VibeMood>('all');

  React.useEffect(() => { queueRef.current = queue; }, [queue]);
  React.useEffect(() => { allPostsRef.current = allPosts; }, [allPosts]);
  React.useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  React.useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);
  React.useEffect(() => { activeMoodRef.current = activeMood; }, [activeMood]);

  const isMiniPlayerVisible = !!activePostId;

  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[], mood: VibeMood) => {
    setIsLoadingQueue(true);
    const localRanked = buildSmartQueue(current, pool, mood);
    const makeUpNext = (ranked: SocialPost[]): QueueEntry[] =>
      ranked.slice(0, 10).map(p => ({
        post: p,
        score: computeVibeScore(current, p, mood),
        reason: buildReason(current, p, mood),
      }));

    setQueue([current, ...localRanked]);
    setUpNext(makeUpNext(localRanked));
    setIsLoadingQueue(false);

    try {
      const availablePosts = localRanked.slice(0, 20).map(p => ({
        id: p.id, content: p.content, tags: p.tags || [],
      }));
      const recommendation = await getRecommendedVibes({
        currentPostContent: current.content,
        userInterests: user?.interests || [],
        availablePosts,
      });
      const aiIds = recommendation.recommendedPostIds;
      const aiPosts = aiIds
        .map(id => pool.find(p => p.id === id))
        .filter((p): p is SocialPost => !!p && p.id !== current.id);
      const aiIdSet = new Set(aiIds);
      const remainingLocal = localRanked.filter(p => !aiIdSet.has(p.id));
      const finalRanked = [...aiPosts, ...remainingLocal];
      setQueue([current, ...finalRanked]);
      setUpNext(makeUpNext(finalRanked));
    } catch (err) {
      console.warn('AI matcher busy:', err);
    }
  }, [user?.interests]);

  const setActivePost = useCallback((post: SocialPost | null) => {
    if (!post) {
      setActivePostId(null);
      setActivePostState(null);
      return;
    }
    setActivePostId(post.id);
    setActivePostState(post);
    setHistory(prev => [post, ...prev.filter(p => p.id !== post.id)].slice(0, HISTORY_MAX));
    rebuildQueue(post, allPostsRef.current, activeMoodRef.current);
  }, [rebuildQueue]);

  const setActiveMood = useCallback((mood: VibeMood) => {
    setActiveMoodState(mood);
    const current = activePostIdRef.current ? allPostsRef.current.find(p => p.id === activePostIdRef.current) : null;
    if (current) rebuildQueue(current, allPostsRef.current, mood);
  }, [rebuildQueue]);

  const playNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentId = activePostIdRef.current;
    if (currentQueue.length <= 1) return;
    const idx = currentQueue.findIndex(p => p.id === currentId);
    const nextPost = currentQueue[(idx + 1) % currentQueue.length];
    if (nextPost) setActivePost(nextPost);
  }, [setActivePost]);

  const playPrev = useCallback(() => {
    if (history.length < 2) return;
    setActivePost(history[1]);
  }, [history, setActivePost]);

  const addToQueue = useCallback((posts: SocialPost[]) => {
    setAllPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const incoming = posts.filter(p => !existingIds.has(p.id));
      return [...prev, ...incoming];
    });
  }, []);

  const sendReaction = useCallback((emoji: VibeReaction) => {
    const postId = activePostIdRef.current;
    if (!postId) return;

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
    setTimeout(() => {
      setReactionBursts(prev => prev.filter(b => b.id !== burst.id));
    }, 1200);
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <VibePlayerContext.Provider value={{
      activePostId, activePost, queue, upNext,
      isContinuous, isLoadingQueue,
      setActivePost, setIsContinuous, playNext, playPrev, addToQueue,
      activeMood, setActiveMood,
      history, clearHistory,
      reactionBursts, sendReaction, reactionCounts,
      isMiniPlayerVisible,
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