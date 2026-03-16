'use client';

/**
 * @fileOverview Liaison Vibe Player Orchestrator.
 * 🚀 ACTIVE ENGINES:
 * 1. Semantic AI Discovery (Cosine Similarity)
 * 2. Infinite Feed Loop (Auto-Scroller)
 * 3. TikTok-Style Prefetching
 * 4. Multi-Armed Bandit Strategy
 * 5. Bot Behavior Tracking Layer 🛡️
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { SocialPost, UserIntelligence, VibeSignal } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useVibeProfile } from '@/hooks/use-vibe-profile';
import { recordEngagement } from '@/lib/trending-service';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import { enforceDiversity } from '@/lib/diversity-engine';
import { logTrendEvent } from '@/lib/trend-logger';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { vibeBufferManager } from '@/lib/vibe-buffer-manager';
import { computeVibeScore } from '@/lib/vibe-scoring';
import { trackUserBehavior } from '@/lib/fraud-protection';

export type MediaCategory = 'video' | 'image' | 'text' | 'audio';

export function getMediaCategory(mediaType: SocialPost['mediaType']): MediaCategory {
  if (mediaType === 'youtube' || mediaType === 'video' || mediaType === 'tiktok') return 'video';
  if (mediaType === 'image') return 'image';
  if (mediaType === 'audio') return 'audio';
  return 'text';
}

export function getMediaLabel(mediaType: SocialPost['mediaType']): string {
  const map: Record<string, string> = {
    youtube: 'YouTube', video: 'Video', tiktok: 'TikTok', image: 'Photo', text: 'Post', audio: 'Shoutout',
  };
  return map[mediaType] ?? mediaType;
}

export const DISPLAY_DURATIONS: Record<MediaCategory, number> = {
  video: 0, image: 8000, text: 6000, audio: 0, // Audio uses its own duration
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

export interface QueueEntry { post: SocialPost; score: number; reason: string; }
export const HISTORY_MAX = 50; 
export const MAX_POOL_SIZE = 1000;

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
  const { user } = useAuth();
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePost, setActivePostState] = useState<SocialPost | null>(null);
  const [queue, setQueue] = useState<SocialPost[]>([]);
  const [upNext, setUpNext] = useState<QueueEntry[]>([]);
  const [allPosts, setAllPosts] = useState<SocialPost[]>([]);
  const [isContinuous, setIsContinuous] = useState(true); 
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [activeMood, setActiveMoodState] = useState<VibeMood>('all');
  const [history, setHistory] = useState<SocialPost[]>([]);
  const [reactionBursts, setReactionBursts] = useState<ReactionBurst[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<VibeReaction, number>>>({});
  const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(true);
  
  const { sessionProfile, recordSignal, getPersonalScore, getTopInterests, isLoaded: isProfileLoaded } = useVibeProfile();

  const [globalTrendScores, setGlobalTrendScores] = useState<Record<string, number>>({});

  const displayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<SocialPost[]>([]);
  const allPostsRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const activePostRef = useRef<SocialPost | null>(null);
  const isContinuousRef = useRef(true);
  const activeMoodRef = useRef<VibeMood>('all');

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { allPostsRef.current = allPosts; }, [allPosts]);
  useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  useEffect(() => { activePostRef.current = activePost; }, [activePost]);
  useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);
  useEffect(() => { activeMoodRef.current = activeMood; }, [activeMood]);

  useEffect(() => {
    if (!firestore) return;
    const unsubTrends = onSnapshot(doc(firestore, 'trend_scores', 'current'), (snap) => { if (snap.exists()) setGlobalTrendScores(snap.data() as Record<string, number>); });
    return () => unsubTrends();
  }, [firestore]);

  const clearDisplayTimer = useCallback(() => { if (displayTimerRef.current) { clearTimeout(displayTimerRef.current); displayTimerRef.current = null; } }, []);

  const rebuildQueue = useCallback(async (current: SocialPost, pool: SocialPost[], mood: VibeMood) => {
    if (!current || pool.length === 0) return;
    
    setIsLoadingQueue(true);
    
    const scoredCandidates = pool
      .filter(p => p.id !== current.id)
      .map(candidate => ({
        post: candidate,
        score: computeVibeScore(candidate, {
          currentPost: current,
          userIntelligence: sessionProfile,
          globalTrendScores,
          activeMood: mood,
          getPersonalScore
        })
      }))
      .sort((a, b) => b.score - a.score);

    let finalPosts = scoredCandidates.map(r => r.post);

    if (finalPosts.length > 5) {
        try {
            const aiReRank = await getRecommendedVibes({ 
              currentPostContent: current.content, 
              userInterests: getTopInterests(10), 
              availablePosts: finalPosts.slice(0, 20).map(p => ({ id: p.id, content: p.content, tags: p.tags })) 
            });
            const aiOrder = new Map(aiReRank.recommendedPostIds.map((id, i) => [id, i]));
            const topTier = finalPosts.filter(p => aiOrder.has(p.id)).sort((a, b) => aiOrder.get(a.id)! - aiOrder.get(b.id)!);
            const others = finalPosts.filter(p => !aiOrder.has(p.id));
            finalPosts = [...topTier, ...others];
        } catch (e) { console.warn("Liaison AI Re-Ranking drifted."); }
    }

    // LIAISON PROTOCOL: Diverse pool must be large enough to contain "all" videos if requested
    const diversePool = enforceDiversity(finalPosts).slice(0, 100);
    
    setQueue([current, ...diversePool]);
    setUpNext(diversePool.slice(0, 20).map(p => ({ 
      post: p, 
      score: 0, 
      reason: 'AI Orchestrated Match' 
    })));
    setIsLoadingQueue(false);
  }, [getPersonalScore, globalTrendScores, sessionProfile, getTopInterests]);

  useEffect(() => {
    if (activePost && allPosts.length > 0) {
        const timer = setTimeout(() => { 
          rebuildQueue(activePost, allPosts, activeMood); 
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [sessionProfile, activeMood, rebuildQueue, activePost, allPosts]);

  useEffect(() => {
    if (!activePostId || upNext.length === 0 || !activePost) return;
    const prefetchTimer = setTimeout(() => {
      const nextThreePosts = upNext.slice(0, 3).map(entry => entry.post);
      vibeBufferManager.maintain([activePost.id, ...nextThreePosts.map(p => p.id)]);
      nextThreePosts.forEach(post => { vibeBufferManager.preload(post); });
    }, 1000); 
    return () => clearTimeout(prefetchTimer);
  }, [activePostId, upNext, activePost]);

  const recordPlay = useCallback((p: SocialPost) => {
    recordSignal(p, 'watch');
    if (firestore && user?.id) {
        recordEngagement(firestore, p.id, 'view', p.authorId, p.createdAt);
        logTrendEvent(firestore, { type: 'video_view', entityId: p.id, campusId: p.campusId, tag: p.tags?.[0] });
        trackUserBehavior(firestore, user.id, 'watch', 5);
    }
  }, [recordSignal, firestore, user?.id]);

  const recordWatchedToEnd = useCallback((p: SocialPost) => {
    recordSignal(p, 'watch');
    if (firestore && user?.id) {
        recordEngagement(firestore, p.id, 'completion', p.authorId, p.createdAt);
        trackUserBehavior(firestore, user.id, 'watch', 15);
    }
  }, [recordSignal, firestore, user?.id]);

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

  const pushToHistory = useCallback((post: SocialPost) => { setHistory(prev => [post, ...prev.filter(p => p.id !== post.id)].slice(0, HISTORY_MAX)); }, []);

  const startDisplayTimer = useCallback((post: SocialPost) => {
    const cat = getMediaCategory(post.mediaType);
    let duration = DISPLAY_DURATIONS[cat];
    if (cat === 'audio') duration = (post.duration || 10) * 1000 + 1000;

    if (duration > 0 && isContinuousRef.current) {
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
      displayTimerRef.current = setTimeout(() => {
        const q = queueRef.current; const id = activePostIdRef.current;
        if (q.length <= 1) return;
        const idx = q.findIndex(p => p.id === id);
        const next = q[idx === -1 ? 0 : (idx + 1) % q.length];
        if (next) { setActivePostId(next.id); setActivePostState(next); pushToHistory(next); }
      }, duration);
    }
  }, [pushToHistory]);

  const setActivePost = useCallback((post: SocialPost | null) => {
    if (!post) { 
      if (activePostIdRef.current) { 
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
    startDisplayTimer(post);
  }, [pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const setActiveMood = useCallback((mood: VibeMood) => { 
    setActiveMoodState(mood); 
  }, []);

  const playNext = useCallback(() => {
    const q = queueRef.current; const id = activePostIdRef.current;
    if (q.length <= 1) return;
    const idx = q.findIndex(p => p.id === id);
    const next = q[idx === -1 ? 0 : (idx + 1) % q.length];
    if (next) { 
      clearDisplayTimer(); 
      setActivePostId(next.id); 
      setActivePostState(next); 
      pushToHistory(next); 
      startDisplayTimer(next); 
    }
  }, [pushToHistory, clearDisplayTimer, startDisplayTimer]);

  const playPrev = useCallback(() => {
    setHistory(prev => { if (prev.length < 2) return prev; const prevPost = prev[1]; clearDisplayTimer(); setActivePostId(prevPost.id); setActivePostState(prevPost); startDisplayTimer(prevPost); return prev.slice(1); });
  }, [clearDisplayTimer, startDisplayTimer]);

  const addToQueue = useCallback((posts: SocialPost[]) => {
    setAllPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const incoming = posts.filter(p => !existingIds.has(p.id));
      if (incoming.length === 0) return prev;
      let merged = [...prev, ...incoming];
      if (merged.length > MAX_POOL_SIZE) merged = merged.slice(-MAX_POOL_SIZE);
      return merged;
    });
    setQueue(prev => prev.length > 0 ? prev : [...posts]);
  }, []);

  const sendReaction = useCallback((emoji: VibeReaction, post: SocialPost) => {
    setReactionCounts(prev => { const counts = prev[post.id] || { '🔥': 0, '🌊': 0, '💎': 0, '👑': 0, '⚡': 0 }; return { ...prev, [post.id]: { ...counts, [emoji]: counts[emoji] + 1 } }; });
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
