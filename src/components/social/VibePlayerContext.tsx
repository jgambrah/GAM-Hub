'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { SocialPost } from '@/lib/types';
import { getRecommendedVibes } from '@/ai/flows/vibe-recommendation-flow';
import { useAuth } from '@/hooks/use-auth';

interface VibePlayerContextType {
  activePostId: string | null;
  queue: SocialPost[];
  isContinuous: boolean;
  setActivePost: (post: SocialPost | null) => void;
  setIsContinuous: (val: boolean) => void;
  playNext: () => void;
  addToQueue: (posts: SocialPost[]) => void;
}

const VibePlayerContext = createContext<VibePlayerContextType | undefined>(undefined);

export function VibePlayerProvider({ children }: { children: React.ReactNode }) {
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [queue, setQueue] = useState<SocialPost[]>([]);
  const [isContinuous, setIsContinuous] = useState(false);
  const { user } = useAuth();

  // Use refs to avoid stale closures in callbacks while keeping referential stability
  const queueRef = useRef<SocialPost[]>([]);
  const activePostIdRef = useRef<string | null>(null);
  const isContinuousRef = useRef(false);

  // Keep refs in sync with state
  React.useEffect(() => { queueRef.current = queue; }, [queue]);
  React.useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
  React.useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);

  const reorderQueueWithAI = useCallback(async (post: SocialPost, currentQueue: SocialPost[]) => {
    try {
      const availablePosts = currentQueue
        .filter(p => p.id !== post.id)
        .map(p => ({ id: p.id, content: p.content, tags: p.tags || [] }));

      const recommendation = await getRecommendedVibes({
        currentPostContent: post.content,
        userInterests: user?.interests || [],
        availablePosts: availablePosts.slice(0, 20),
      });

      const newQueueIds = recommendation.recommendedPostIds;
      const matchedPosts = newQueueIds
        .map(id => currentQueue.find(p => p.id === id))
        .filter((p): p is SocialPost => !!p);

      const remaining = currentQueue.filter(
        p => p.id !== post.id && !newQueueIds.includes(p.id)
      );

      setQueue([post, ...matchedPosts, ...remaining]);
    } catch (err) {
      console.warn('Liaison Vibe Matcher failed, falling back to sequential:', err);
    }
  }, [user?.interests]);

  // Called when a user manually clicks play, or when a card's onPlay fires
  const setActivePost = useCallback((post: SocialPost | null) => {
    if (!post) {
      setActivePostId(null);
      return;
    }

    setActivePostId(post.id);

    if (isContinuousRef.current && queueRef.current.length > 0) {
      reorderQueueWithAI(post, queueRef.current);
    }
  }, [reorderQueueWithAI]);

  // Called when a video ends — advances the queue without triggering AI reorder
  // (AI reorder will fire via setActivePost once the next card's onPlay event fires)
  const playNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentId = activePostIdRef.current;

    if (currentQueue.length <= 1) return;

    const currentIndex = currentQueue.findIndex(p => p.id === currentId);
    // If not found (-1), start from 0; otherwise advance
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % currentQueue.length;
    const nextPost = currentQueue[nextIndex];

    if (nextPost) {
      console.log('📡 Vibe-Stream: Advancing to next vibration:', nextPost.id);
      // Only update the ID here — the SocialPostCard useEffect will trigger playback.
      // setActivePost (with AI reorder) fires when that card's onPlay event fires.
      setActivePostId(nextPost.id);
    }
  }, []); // No deps needed — reads from refs

  const addToQueue = useCallback((posts: SocialPost[]) => {
    setQueue(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newPosts = posts.filter(
        p =>
          !existingIds.has(p.id) &&
          (p.mediaType === 'youtube' || p.mediaType === 'tiktok' || p.mediaType === 'video')
      );
      if (newPosts.length === 0) return prev;
      return [...prev, ...newPosts];
    });
  }, []);

  return (
    <VibePlayerContext.Provider
      value={{
        activePostId,
        queue,
        isContinuous,
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
