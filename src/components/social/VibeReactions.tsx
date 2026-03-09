'use client';

import React from 'react';
import { useVibePlayer, REACTIONS, type VibeReaction } from './VibePlayerContext';
import { cn } from '@/lib/utils';

export function VibeReactionBar({ postId }: { postId: string }) {
  const { sendReaction, reactionCounts } = useVibePlayer();
  const counts = reactionCounts[postId] || {};

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {REACTIONS.map(emoji => {
        const count = counts[emoji] || 0;
        return (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-2 rounded-2xl border-2 transition-all duration-200 active:scale-90 select-none',
              count > 0
                ? 'bg-foreground/5 border-foreground/20 hover:border-foreground/40'
                : 'bg-muted border-transparent hover:border-muted-foreground/30'
            )}
          >
            <span className="text-lg leading-none group-active:scale-125 transition-transform duration-100 inline-block">
              {emoji}
            </span>
            {count > 0 && (
              <span className="text-[10px] font-black text-foreground tabular-nums">
                {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function VibeReactionBursts() {
  const { reactionBursts } = useVibePlayer();

  if (reactionBursts.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {reactionBursts.map(burst => (
        <ReactionParticle key={burst.id} burst={burst} />
      ))}
    </div>
  );
}

function ReactionParticle({ burst }: { burst: any }) {
  const driftX = (Math.random() - 0.5) * 100;
  const scale = 1.2 + Math.random() * 0.8;

  return (
    <div
      className="absolute text-4xl animate-reaction-burst"
      style={{
        left: `${burst.x}%`,
        top: `${burst.y}%`,
        ['--drift-x' as any]: `${driftX}px`,
        ['--scale' as any]: scale,
      }}
    >
      {burst.emoji}
    </div>
  );
}