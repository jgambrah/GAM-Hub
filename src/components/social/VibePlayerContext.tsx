'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { SocialPost } from '@/lib/types';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { useAuth } from '@/hooks/use-auth';

// ─── SIMILARITY ENGINE ────────────────────────────────────────────────────────
// Scores a candidate post against the currently playing post.
// Weights: tags > mediaType > campus > author > engagement > recency
function computeVibeScore(current: SocialPost, candidate: SocialPost): number {
  let score = 0;

  // 1. Tag overlap — strongest signal (up to 50 pts)
  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const sharedTags = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
  score += sharedTags.length * 10;

  // 2. Same media type — keeps the session consistent (15 pts)
  if (candidate.mediaType === current.mediaType) score += 15;

  // 3. Campus — local relevance; global seeds get partial credit (10 / 5 pts)
  if (candidate.campusId === current.campusId) score += 10;
  else if (candidate.campusId === 'all' || current.campusId === 'all') score += 5;

  // 4. Same creator — surface more from a creator the user chose (8 pts)
  if (candidate.authorId === current.authorId) score += 8;

  // 5. Engagement momentum — normalised to max 12 pts
  score += Math.min((candidate.likes || 0) / 5, 12);

  // 6. Recency boost — posts < 7 days old score up to 5 extra pts
  if (candidate.createdAt) {
    const createdAtDate = typeof candidate.createdAt === 'string' 
      ? new Date(candidate.createdAt) 
      : candidate.createdAt.toDate ? candidate.createdAt.toDate() : new Date();
    const ageDays = (Date.now() - createdAtDate.getTime()) / 86_400_000;
    if (ageDays < 7) score += Math.max(0, 5 - ageDays);
  }

  return score;
}

function buildSmartQueue(current: SocialPost, pool: SocialPost[]): SocialPost[] {
  const candidates = pool.filter(
    p =>
      p.id !== current.id &&
      (p.mediaType === 'youtube' || p.mediaType === 'video' || p.mediaType === 'tiktok')
  );
  return candidates
    .map(p => ({ post: p, score: computeVibeScore(current, p) }))
    .sort((a, b) => b.score - a.score)
    .map(s => s.post);
}

function buildReason(current: SocialPost, candidate: SocialPost): string {
  const parts: string[] = [];
  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const shared = (candidate.tags || []).filter(t => currentTags.has(t.toLowerCase()));
  if (shared.length > 0) parts.push(`#${shared[0]}`);
  if (candidate.campusId === current.campusId) parts.push('Same campus');
  if (candidate.authorId === current.authorId) parts.push('Same creator');
  if (candidate.mediaType === current.mediaType && parts.length < 2)
    parts.push(candidate.mediaType);
  if (parts.length === 0) parts.push('Trending on the Yard');
  return parts.slice(0, 2).join(' · ');
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface QueueEntry {
  post: SocialPost;
  score: number;
  reason: string;
}

interface VibePlayerContextType {
  activePostId: string | null;
  activePost: SocialPost | null;
  queue: SocialPost[];
  upNext: QueueEntry[];         // annotated list for the "Up Next" UI panel
  isContinuous: boolean;
  isLoadingQueue: boolean;
  setActivePost: (post: SocialPost | null) => void;
  setIsContinuous: (val: boolean) => void;
  playNext: () => void;
  addToQueue: (posts: SocialPost[]) => void;
}

const VibePlayerContext = createContext<VibePlayerContextType | undefined>(undefined);

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function VibePlayerProvider({ children }: { children: React.ReactNode }) {
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePost, setActivePostState] = useState<SocialPost | null>(null);
  const [queue, setQueue] = useState<SocialPost[]>([]);
  const [upNext, setUpNext] = useState<QueueEntry[]>([]);
  const [allPosts, setAllPosts] = useState<SocialPost[]>([]);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const { user } = useAuth();

  // Refs prevent stale closures in event-driven callbacks
  const queueRef = useRef<SocialPost[]>([]);
  const allPostsRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const isContinuousRef = useRef(false);

  React.useEffect(() => { queueRef.current = queue; }, [queue]);
  React.useEffect(() => { allPostsRef.current = allPosts; }, [allPosts]);
  React.useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  React.useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);

  // ── Rebuild the smart queue whenever the active vibe changes ─────────────────
  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[]) => {
    setIsLoadingQueue(true);

    // Phase 1 — local scoring (sync, instant)
    const localRanked = buildSmartQueue(current, pool);
    const makeUpNext = (ranked: SocialPost[]): QueueEntry[] =>
      ranked.slice(0, 10).map(p => ({
        post: p,
        score: computeVibeScore(current, p),
        reason: buildReason(current, p),
      }));

    setQueue([current, ...localRanked]);
    setUpNext(makeUpNext(localRanked));
    setIsLoadingQueue(false); // UI is already usable

    // Phase 2 — AI refinement (async, silent upgrade)
    try {
      const availablePosts = localRanked.slice(0, 20).map(p => ({
        id: p.id,
        content: p.content,
        tags: p.tags || [],
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
      console.warn('AI vibe matcher unavailable, using local scores:', err);
    }
  }, [user?.interests]);

  // ── setActivePost ─────────────────────────────────────────────────────────────
  const setActivePost = useCallback((post: SocialPost | null) => {
    if (!post) {
      setActivePostId(null);
      setActivePostState(null);
      return;
    }
    setActivePostId(post.id);
    setActivePostState(post);
    rebuildQueue(post, allPostsRef.current);
  }, [rebuildQueue]);

  // ── playNext ──────────────────────────────────────────────────────────────────
  const playNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentId = activePostIdRef.current;
    if (currentQueue.length <= 1) return;

    const idx = currentQueue.findIndex(p => p.id === currentId);
    const nextPost = currentQueue[idx === -1 ? 0 : (idx + 1) % currentQueue.length];

    if (nextPost) {
      console.log('📡 Vibe-Stream → advancing to:', nextPost.content.slice(0, 40));
      // Explicitly call the full setter to ensure auto-play handshake fires
      setActivePost(nextPost);
    }
  }, [setActivePost]);

  // ── addToQueue ────────────────────────────────────────────────────────────────
  const addToQueue = useCallback((posts: SocialPost[]) => {
    setAllPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const incoming = posts.filter(p => !existingIds.has(p.id));
      if (incoming.length === 0) return prev;
      const merged = [...prev, ...incoming];

      const currentId = activePostIdRef.current;
      const currentPost = currentId ? merged.find(p => p.id === currentId) : null;
      if (currentPost && isContinuousRef.current) {
        setTimeout(() => rebuildQueue(currentPost, merged), 0);
      }

      return merged;
    });

    setQueue(prev => {
      if (prev.length > 0) return prev;
      return posts.filter(
        p => p.mediaType === 'youtube' || p.mediaType === 'video' || p.mediaType === 'tiktok'
      );
    });
  }, [rebuildQueue]);

  return (
    <VibePlayerContext.Provider
      value={{
        activePostId,
        activePost,
        queue,
        upNext,
        isContinuous,
        isLoadingQueue,
        setActivePost,
        setIsContinuous,
        playNext,
        addToQueue,
      }}
    >
      {children}
    </VibePlayerContext.Provider>
  );
}

export const useVibePlayer = () => {
  const context = useContext(VibePlayerContext);
  if (!context) throw new Error('useVibePlayer must be used within VibePlayerProvider');
  return context;
};
