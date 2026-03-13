'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { AdCampaign } from './vibeAdsSchema';
import { cn } from '@/lib/utils';
import { ExternalLink, Volume2, VolumeX, Megaphone } from 'lucide-react';
import { useSound } from '@/context/SoundContext';

interface VibeAdCardProps {
  ad: AdCampaign;
  onImpression: (adId: string) => void;
  onClickCta: (ad: AdCampaign) => void;
}

export default function VibeAdCard({ ad, onImpression, onClickCta }: VibeAdCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasTrackedImpression = useRef(false);
  const { soundOn, toggleSound } = useSound();

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true;
          onImpression(ad.id);
          if (ad.mediaType === 'video' && videoRef.current) {
            videoRef.current.play().catch(() => {});
            setIsVideoPlaying(true);
          }
        } else if (!entry.isIntersecting && ad.mediaType === 'video' && videoRef.current) {
          videoRef.current.pause();
          setIsVideoPlaying(false);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [ad.id, ad.mediaType, onImpression]);

  // Sync the video element's muted state with the global SoundContext
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !soundOn;
    }
  }, [soundOn]);

  return (
    <div
      ref={cardRef}
      className={cn(
        'group relative bg-card rounded-[2.5rem] border overflow-hidden transition-all duration-500',
        'border-border shadow-sm hover:shadow-xl',
        'ring-1 ring-amber-200/60 dark:ring-amber-800/30'
      )}
    >
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md">
          <Megaphone size={8} fill="white" /> Sponsored
        </div>
      </div>

      <div 
        onClick={toggleSound}
        className="relative aspect-video bg-slate-950 overflow-hidden group/media cursor-pointer"
      >
        {ad.mediaType === 'image' && ad.mediaUrl && (
          <Image
            src={ad.mediaUrl} alt={ad.headline} fill
            className="object-cover transition-transform duration-700 group-hover/media:scale-105"
          />
        )}

        {ad.mediaType === 'video' && ad.mediaUrl && (
          <>
            <video
              ref={videoRef}
              src={ad.mediaUrl}
              poster={ad.thumbnailUrl}
              muted={!soundOn}
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            <button
              onClick={(e) => { e.stopPropagation(); toggleSound(); }}
              className="absolute bottom-3 right-3 z-10 p-2 bg-black/60 backdrop-blur-sm text-white rounded-xl hover:bg-black/80 transition-all active:scale-95"
              title={!soundOn ? 'Unmute' : 'Mute'}
            >
              {!soundOn ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            {!soundOn && isVideoPlaying && (
              <div className="absolute inset-0 flex items-end justify-center pb-12 pointer-events-none animate-in fade-in duration-500">
                <div className="bg-black/50 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                  <VolumeX size={9} /> Tap to unmute
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-3">
          {ad.advertiserLogo && (
            <div className="relative w-8 h-8 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border">
              <Image src={ad.advertiserLogo} alt={ad.advertiserName} fill className="object-contain p-0.5" />
            </div>
          )}
          <div>
            <p className="text-xs font-black text-foreground">{ad.advertiserName}</p>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">Sponsored</p>
          </div>
        </div>

        <h3 className="font-bold text-base text-foreground leading-snug mb-1">
          {ad.headline}
        </h3>

        {ad.body && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
            {ad.body}
          </p>
        )}

        <button
          onClick={() => onClickCta(ad)}
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'bg-amber-500 hover:bg-amber-600 active:scale-[0.98]',
            'text-white font-black text-sm uppercase tracking-wider',
            'py-3 rounded-2xl shadow-lg shadow-amber-500/20 transition-all duration-200'
          )}
        >
          {ad.ctaLabel}
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
