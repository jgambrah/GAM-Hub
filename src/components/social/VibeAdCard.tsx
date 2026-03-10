'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import type { AdCampaign } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { ExternalLink, Megaphone, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import ReactPlayer from 'react-player';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

/**
 * VibeAdCard Component
 * ---------------------
 * A sponsored vibration that tracks impressions and clicks.
 * Features TikTok-style muted autoplay on scroll.
 */
export default function VibeAdCard({ ad }: { ad: AdCampaign }) {
  const { firestore, auth } = useFirebase();
  const { user } = useAuth();
  
  const [hasImpressed, setHasImpressed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // 1. Impression Tracking (Intersection Observer)
  useEffect(() => {
    if (hasImpressed || !firestore || !user) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        
        // Count impression if visible for > 500ms
        if (entry.isIntersecting && !hasImpressed) {
          const timer = setTimeout(() => {
            if (entry.isIntersecting) {
              recordEvent('impressions');
              setHasImpressed(true);
            }
          }, 500);
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.5 } // 50% visibility required
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [firestore, user, hasImpressed]);

  const recordEvent = (type: 'impressions' | 'clicks') => {
    if (!firestore || !user) return;
    
    const eventRef = collection(firestore, 'ad_campaigns', ad.id, type);
    addDocumentNonBlocking(eventRef, {
      userId: user.id,
      campusId: user.campusId,
      timestamp: serverTimestamp(),
      sessionId: window.sessionStorage.getItem('vibe_session') || 'anonymous',
      ...(type === 'clicks' ? { ctaUrl: ad.ctaUrl } : {})
    });
  };

  const handleCTAClick = () => {
    recordEvent('clicks');
    window.open(ad.ctaUrl, '_blank');
  };

  return (
    <div 
      ref={cardRef}
      className="bg-card rounded-[2.5rem] border-2 border-primary/10 overflow-hidden shadow-xl animate-in fade-in duration-700"
    >
      {/* ── SPONSORED HEADER ── */}
      <div className="px-6 py-4 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-border bg-white shadow-sm">
            <Image src={ad.advertiserLogo} fill alt={ad.advertiserName} className="object-contain p-1" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">{ad.advertiserName}</p>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1">
              <ShieldCheck size={8} /> Sponsored
            </p>
          </div>
        </div>
        <div className="p-2 bg-primary/10 text-primary rounded-xl">
          <Megaphone size={14} />
        </div>
      </div>

      {/* ── MEDIA ZONE ── */}
      <div className="relative aspect-video bg-slate-900 group">
        {ad.mediaType === 'video' ? (
          <div className="w-full h-full">
            <ReactPlayer 
              url={ad.mediaUrl}
              playing={isVisible}
              muted={isMuted}
              loop={true}
              width="100%"
              height="100%"
              playsinline
              config={{ file: { attributes: { style: { objectFit: 'cover' } } } }}
            />
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="absolute bottom-4 right-4 p-3 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-black/60 transition-all z-10"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        ) : (
          <Image src={ad.mediaUrl} fill className="object-cover" alt={ad.headline} />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* ── AD COPY & CTA ── */}
      <div className="p-8 space-y-6">
        <div>
          <h3 className="text-2xl font-black text-foreground leading-tight tracking-tight">
            {ad.headline}
          </h3>
          {ad.body && (
            <p className="text-sm text-muted-foreground mt-3 font-medium leading-relaxed italic">
              "{ad.body}"
            </p>
          )}
        </div>

        <Button 
          onClick={handleCTAClick}
          className="w-full py-8 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-primary transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          {ad.ctaLabel} <ExternalLink size={20} />
        </Button>

        <p className="text-[8px] text-center text-muted-foreground/50 font-black uppercase tracking-[0.4em]">
          Liaison National Advertising Hub
        </p>
      </div>
    </div>
  );
}
