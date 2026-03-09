'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
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

  const setActivePost = useCallback(async (post: SocialPost | null) => {
    if (!post) {
      setActivePostId(null);
      return;
    }

    setActivePostId(post.id);

    // If continuous mode is ON, intelligently rebuild the queue starting from this post
    if (isContinuous && queue.length > 0) {
      try {
        const availablePosts = queue.filter(p => p.id !== post.id).map(p => ({
          id: p.id,
          content: p.content,
          tags: p.tags || []
        }));

        const recommendation = await getRecommendedVibes({
          currentPostContent: post.content,
          userInterests: user?.interests || [],
          availablePosts: availablePosts.slice(0, 20) // Only analyze top 20 for speed
        });

        const newQueueIds = recommendation.recommendedPostIds;
        const matchedPosts = newQueueIds
          .map(id => queue.find(p => p.id === id))
          .filter(p => !!p) as SocialPost[];
        
        // Final queue: [Selected Post, ...Matched AI Recommendations, ...Rest of randoms]
        const remaining = queue.filter(p => p.id !== post.id && !newQueueIds.includes(p.id));
        setQueue([post, ...matchedPosts, ...remaining]);
      } catch (err) {
        console.error("Liaison Matcher Error:", err);
        // Fallback: move selected post to front of existing queue
        setQueue(prev => {
            const rest = prev.filter(p => p.id !== post.id);
            return [post, ...rest];
        });
      }
    }
  }, [isContinuous, queue, user?.interests]);

  const playNext = useCallback(() => {
    if (queue.length <= 1) return;
    
    // Find current index
    const currentIndex = queue.findIndex(p => p.id === activePostId);
    const nextIndex = (currentIndex + 1) % queue.length;
    
    const nextPost = queue[nextIndex];
    if (nextPost) {
      setActivePostId(nextPost.id);
    }
  }, [activePostId, queue]);

  const addToQueue = useCallback((posts: SocialPost[]) => {
    // Only add unique posts
    setQueue(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newPosts = posts.filter(p => 
        !existingIds.has(p.id) && 
        (p.mediaType === 'youtube' || p.mediaType === 'tiktok' || p.mediaType === 'video')
      );
      
      if (newPosts.length === 0) return prev; // Prevent unnecessary state updates
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
