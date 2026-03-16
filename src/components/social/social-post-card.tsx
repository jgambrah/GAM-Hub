
'use client';

import Image from 'next/image';
import * as React from 'react';
import type { SocialPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ThumbsUp, MessageCircle, Share2, Youtube, Play, PlayCircle,
  Video, Trash2, Globe, AlertTriangle, FastForward, Minimize2,
  ImageIcon, FileText, ArrowRight, Zap, Volume2, VolumeX, Mic, Music, TrendingUp, BarChart3,
  UserPlus, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import CommentSection from './CommentSection';
import ReactPlayer from 'react-player';
import YouTube from 'react-youtube';
import { useToast } from '@/hooks/use-toast';
import {
  useVibePlayer,
  getMediaCategory,
  getMediaLabel,
  DISPLAY_DURATIONS,
} from './VibePlayerContext';
import { useSound } from '@/context/SoundContext';
import { VibeReactionBar } from './VibeReactions';
import { recordEngagement } from '@/lib/trending-service';
import { renderWithHashtags } from '@/lib/hashtag-utils';
import VibeShopOverlay from './VibeShopOverlay';
import VoicePlayer from './VoicePlayer';
import { BoostVibeDialog } from '../arena/BoostVibeDialog';
import { HighlightAnalyticsDialog } from '../arena/HighlightAnalyticsDialog';
import dynamic from 'next/dynamic';

const TikTokEmbed = dynamic(() => import('./tiktok-embed').then(mod => mod.TikTokEmbed), {
  ssr: false,
  loading: () => <div className="h-[500px] w-[325px] bg-muted animate-pulse rounded-lg mx-auto" />
});

const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function MediaTypeIcon({ mediaType, size = 10 }: { mediaType: SocialPost['mediaType']; size?: number }) {
  if (mediaType === 'youtube') return <Youtube size={size} className="text-red-500" />;
  if (mediaType === 'tiktok' || mediaType === 'video') return <Video size={size} />;
  if (mediaType === 'image') return <ImageIcon size={size} />;
  if (mediaType === 'audio') return <Mic size={size} className="text-blue-500" />;
  return <FileText size={size} />;
}

export default function SocialPostCard({ post }: { post: SocialPost }) {
  const { user, isAdmin } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { soundOn, toggleSound } = useSound();
  const {
    activePostId, isContinuous, playNext,
    setActivePost, addToQueue,
    recordPlay, recordWatchedToEnd, recordLike, recordUnlike,
    recordSkip,
  } = useVibePlayer();

  const [isLiked, setIsLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(post.likes);
  const [isProcessingLike, setIsProcessingLike] = React.useState(false);
  const [showComments, setShowComments] = React.useState(false);
  const [isRestricted, setIsRestricted] = React.useState(false);
  const [showBoostDialog, setShowBoostDialog] = React.useState(false);
  const [showAnalytics, setShowAnalytics] = React.useState(false);
  
  const [isSkippingRestricted, setIsSkippingRestricted] = React.useState(false);
  const [skipCountdown, setSkipCountdown] = React.useState<number | null>(null);
  const skipTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const dwellStartTimeRef = React.useRef<number | null>(null);
  const ytPlayerRef = React.useRef<any>(null);
  const ytReadyRef = React.useRef(false);
  const [ytMounted, setYtMounted] = React.useState(false);
  const [reactPlayerMounted, setReactPlayerMounted] = React.useState(false);
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const countdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const cardRef = React.useRef<HTMLDivElement>(null);
  const hasRecordedPlay = React.useRef(false); 
  const hasTrackedPromotionImpression = React.useRef(false);

  const isAuthor = user?.id === post.authorId;
  const canDelete = isAuthor || isAdmin;
  const canBoost = isAuthor && (post.type === 'arena_highlight' || post.isArenaEntry);
  const isGlobalSeed = post.campusId === 'all';
  const isActiveVibe = activePostId === post.id;
  const mediaCategory = getMediaCategory(post.mediaType);

  const isFollowing = user?.followedUsers?.includes(post.authorId) || false;
  const [isProcessingFollow, setIsProcessingFollow] = React.useState(false);

  const videoSource = post.hlsUrl || post.mediaUrl;

  React.useEffect(() => {
    addToQueue([post]);
  }, [post.id, addToQueue]);

  // 🚀 PROMOTION TRACKING PROTOCOL (STEP 5)
  React.useEffect(() => {
    if (!post.isPromoted || hasTrackedPromotionImpression.current || !firestore || isAuthor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedPromotionImpression.current) {
          hasTrackedPromotionImpression.current = true;
          
          const postRef = doc(firestore, 'campus_pulse', post.id);
          const statsRef = doc(firestore, 'highlight_stats', post.id);
          
          const delivered = (post.promotionViewsDelivered || 0) + 1;
          const target = post.promotionViewsTarget || 0;
          
          const updates: any = {
            promotionViewsDelivered: increment(1)
          };
          
          // Auto-Stop Protocol
          if (delivered >= target && target > 0) {
            updates.isPromoted = false;
          }
          
          updateDoc(postRef, updates).catch(e => console.warn("Liaison Analytics: Promo track drifted.", e));
          
          // Sync to persistent analytics node
          setDoc(statsRef, {
              views: increment(1),
              updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post.id, post.isPromoted, post.promotionViewsDelivered, post.promotionViewsTarget, firestore, isAuthor]);

  React.useEffect(() => {
    if (isActiveVibe) {
      if (post.mediaType === 'video') setReactPlayerMounted(true);
      if (post.mediaType === 'youtube') setYtMounted(true);
    }
  }, [isActiveVibe, post.mediaType]);

  React.useEffect(() => {
    if (isActiveVibe && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [isActiveVibe]);

  React.useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dwellStartTimeRef.current = Date.now();
        } else {
          if (dwellStartTimeRef.current) {
            const timeVisible = Date.now() - dwellStartTimeRef.current;
            if (timeVisible < 2000 && !isActiveVibe) {
              recordSkip(post);
            }
            dwellStartTimeRef.current = null;
          }
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post, recordSkip, isActiveVibe]);

  React.useEffect(() => {
    if (isActiveVibe && !hasRecordedPlay.current) {
      hasRecordedPlay.current = true;
      recordPlay(post);
    }
    if (!isActiveVibe) {
      hasRecordedPlay.current = false;
    }
  }, [isActiveVibe, post, recordPlay]);

  React.useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (isActiveVibe && isContinuous && mediaCategory !== 'video' && mediaCategory !== 'audio') {
      const totalSecs = DISPLAY_DURATIONS[mediaCategory] / 1000;
      setCountdown(totalSecs);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            recordWatchedToEnd(post);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(null);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [isActiveVibe, isContinuous, mediaCategory, post, recordWatchedToEnd]);

  React.useEffect(() => {
    if (isActiveVibe && isSkippingRestricted && skipCountdown === 0) {
      setIsSkippingRestricted(false);
      setSkipCountdown(null);
      if (skipTimerRef.current) clearInterval(skipTimerRef.current);
      playNext();
    }
  }, [skipCountdown, isSkippingRestricted, playNext, isActiveVibe]);

  React.useEffect(() => {
    if (post.mediaType !== 'youtube') return;
    if (!isActiveVibe && ytReadyRef.current && ytPlayerRef.current) {
      try { if (typeof ytPlayerRef.current.pauseVideo === 'function') ytPlayerRef.current.pauseVideo(); } catch (_) { }
    }
  }, [isActiveVibe, post.mediaType]);

  React.useEffect(() => {
    if (!user || !firestore) return;
    const likeRef = doc(firestore, 'campus_pulse', post.id, 'likedBy', user.id);
    getDoc(likeRef).then(snap => { if (snap.exists()) setIsLiked(true); });
  }, [firestore, user, post.id]);

  const handleLike = async () => {
    if (!user || !firestore || isProcessingLike) return;
    setIsProcessingLike(true);
    const likeRef = doc(firestore, 'campus_pulse', post.id, 'likedBy', user.id);
    const postRef = doc(firestore, 'campus_pulse', post.id);
    const statsRef = doc(firestore, 'highlight_stats', post.id);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likes: increment(-1) });
        setLikeCount(prev => prev - 1);
        setIsLiked(false);
        recordUnlike(post);
      } else {
        await setDoc(likeRef, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likes: increment(1) });
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
        recordLike(post);
        recordEngagement(firestore, post.id, 'like', post.authorId, post.createdAt);
        
        // 🚀 Promotion Analytics Sync
        if (post.isPromoted) {
            setDoc(statsRef, { likes: increment(1), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
        }
      }
    } catch (error) { console.error(error); }
    finally { setIsProcessingLike(false); }
  };

  const handleShare = async () => {
    if (!firestore) return;
    recordEngagement(firestore, post.id, 'share', post.authorId, post.createdAt);
    
    // 🚀 Promotion Analytics Sync
    if (post.isPromoted) {
        const statsRef = doc(firestore, 'highlight_stats', post.id);
        setDoc(statsRef, { shares: increment(1), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    }

    const shareData = {
        title: 'Check this out on GAM Hub',
        text: post.content,
        url: window.location.origin + `/pulse?postId=${post.id}`,
    };

    if (navigator.share) {
        try { await navigator.share(shareData); return; } catch { }
    }

    try {
        await navigator.clipboard.writeText(shareData.url);
        toast({ title: "Link Copied!" });
    } catch { toast({ variant: 'destructive', title: "Share Failed" }); }
  };

  const handleFollow = async () => {
    if (!user || !firestore || isProcessingFollow || isAuthor) return;
    setIsProcessingFollow(true);
    
    const userRef = doc(firestore, 'users', user.id);
    const statsRef = doc(firestore, 'highlight_stats', post.id);

    try {
        if (isFollowing) {
            await updateDoc(userRef, { followedUsers: arrayRemove(post.authorId) });
            toast({ title: "Unfollowed Creator" });
        } else {
            await updateDoc(userRef, { followedUsers: arrayUnion(post.authorId) });
            
            // 🚀 Growth Loop Analytics: Attribute follow to THIS highlight if promoted
            if (post.isPromoted) {
                setDoc(statsRef, { followersGained: increment(1), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
            }
            
            toast({ title: `Now Following ${post.authorName}! 🤝` });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: "Follow Failed" });
    } finally {
        setIsProcessingFollow(false);
    }
  };

  const handleDeletePost = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!firestore || !post.id) return;
    if (window.confirm('Retract this vibration from the Yard?')) {
      try {
        const col = post.type === 'src_official' ? 'src_posts' : 'campus_pulse';
        await deleteDoc(doc(firestore, col, post.id));
        toast({ title: 'Vibe Retracted' });
      } catch { toast({ variant: 'destructive', title: 'Action Denied' }); }
    }
  };

  const handleEnd = () => {
    recordWatchedToEnd(post);
    if (isContinuous) {
      toast({ title: 'AI Match Found', description: 'Continuing the narative...' });
      setTimeout(() => playNext(), 500);
    }
  };

  const onYoutubeReady = React.useCallback((event: any) => {
    ytPlayerRef.current = event.target;
    ytReadyRef.current = true;
  }, []);

  const onYoutubePlay = React.useCallback(() => {
    setActivePost(post);
  }, [setActivePost, post]);

  const handleYoutubeError = React.useCallback((e: { data: number }) => {
    if (e.data === 101 || e.data === 150) {
        setIsRestricted(true);
        if (isContinuous) {
            setIsSkippingRestricted(true);
            setSkipCountdown(3);
            if (skipTimerRef.current) clearInterval(skipTimerRef.current);
            skipTimerRef.current = setInterval(() => {
                setSkipCountdown(prev => (prev === null || prev <= 1) ? 0 : prev - 1);
            }, 1000);
        }
    }
  }, [isContinuous]);

  const youtubeId = post.mediaType === 'youtube' ? getYouTubeId(post.mediaUrl || '') : null;
  const activeAspect = mediaCategory === 'video' ? 'aspect-video md:aspect-[21/9]' : 'aspect-video';

  const promotionProgress = post.promotionViewsTarget ? Math.min(((post.promotionViewsDelivered || 0) / post.promotionViewsTarget) * 100, 100) : 0;

  return (
    <div
      ref={cardRef}
      data-post-id={post.id}
      className={cn(
        'group relative bg-card rounded-[3rem] border-2 overflow-hidden transition-all duration-500',
        !isActiveVibe ? 'border-border shadow-sm hover:shadow-xl' : 'border-blue-500 shadow-[0_0_80px_rgba(59,130,246,0.3)] ring-2 ring-blue-500/50 col-span-full z-10',
        isGlobalSeed && !isActiveVibe && 'border-amber-200'
      )}
    >
      {/* STEP 5: PROMOTED INDICATOR */}
      {post.isPromoted && (
          <div className="absolute top-6 left-6 z-20 animate-in zoom-in duration-500">
              <div className="bg-red-600 text-white px-4 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border-2 border-white/20">
                  <TrendingUp size={12} fill="white" /> Promoted Highlight
              </div>
          </div>
      )}

      {isGlobalSeed && !post.isPromoted && (
        <div className="absolute top-6 left-6 z-20 animate-in zoom-in duration-500">
          <div className="bg-amber-500 text-slate-950 px-4 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border-2 border-white/20">
            <Globe size={12} /> Global Vibe
          </div>
        </div>
      )}

      {isActiveVibe && (
        <div className="absolute top-6 right-6 z-20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {isContinuous && (
            <div className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-2xl animate-pulse border-2 border-white/20">
              <FastForward size={12} fill="white" /> ACTIVE STREAM
            </div>
          )}
          {countdown !== null && (
            <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-2xl text-[11px] font-black tabular-nums border border-white/10 shadow-xl">
              Next in {countdown}s
            </div>
          )}
          <button
            onClick={() => setActivePost(null)}
            className="p-3 bg-black/60 backdrop-blur-md text-white rounded-2xl hover:bg-black transition-all active:scale-90 border border-white/10 shadow-xl"
          >
            <Minimize2 size={16} />
          </button>
        </div>
      )}

      {isActiveVibe && mediaCategory === 'video' && (
        <div className="absolute bottom-24 right-6 z-30 animate-in fade-in zoom-in duration-500">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleSound(); }}
            className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-2xl shadow-2xl hover:scale-110 active:scale-90 transition-all group"
          >
            {!soundOn ? <VolumeX size={24} className="group-hover:text-red-400" /> : <Volume2 size={24} className="group-hover:text-blue-400" />}
          </button>
        </div>
      )}

      {/* 🎙️ SHOUTOUT HERO STAGE */}
      {post.mediaType === 'audio' && (
        <div 
          onClick={() => setActivePost(post)}
          className={cn(
            'relative bg-slate-900 overflow-hidden flex-shrink-0 flex flex-col items-center justify-center gap-6 p-12 transition-all duration-700 ease-in-out cursor-pointer',
            isActiveVibe ? 'aspect-video md:aspect-[21/9]' : 'aspect-video group/media'
          )}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent)] animate-pulse" />
            <div className="relative z-10 p-10 bg-white/5 backdrop-blur-xl rounded-full border-4 border-white/10 shadow-2xl group-hover/media:scale-110 transition-transform duration-500">
                <Mic size={64} className={cn("transition-colors", isActiveVibe ? "text-amber-400" : "text-blue-400")} />
            </div>
            <div className="relative z-10 text-center">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Vocal Vibration</p>
                <div className="flex gap-1.5 justify-center">
                    {[0.4, 0.8, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
                        <div 
                            key={i} 
                            className={cn("w-2 rounded-full transition-all", isActiveVibe ? "bg-amber-500 animate-bounce" : "bg-blue-500/40 h-4")} 
                            style={{ height: isActiveVibe ? `${h * 40}px` : '16px', animationDelay: `${i * 0.1}s` }} 
                        />
                    ))}
                </div>
            </div>
        </div>
      )}

      {post.mediaType !== 'text' && post.mediaType !== 'audio' && (
        <div 
          onClick={() => { if(isActiveVibe && mediaCategory === 'video') toggleSound(); }}
          className={cn(
            'relative bg-slate-950 overflow-hidden flex-shrink-0 transition-all duration-700 ease-in-out cursor-pointer',
            isActiveVibe ? activeAspect : 'aspect-video group/media'
          )}
        >
          {post.productTags && post.productTags.length > 0 && (
            <VibeShopOverlay postId={post.id} productIds={post.productTags} isActive={isActiveVibe} />
          )}

          {(post.mediaType === 'video' || post.mediaType === 'image') && post.imageUrl && !isActiveVibe && (
            <Image src={post.imageUrl} alt="vibe" fill className={cn('object-cover transition-transform duration-700', !isActiveVibe && 'group-hover/media:scale-105')} />
          )}

          {post.mediaType === 'youtube' && youtubeId && (
            <div className="relative w-full h-full">
              {(!ytMounted && !isActiveVibe) ? (
                <div className="absolute inset-0 cursor-pointer group/poster" onClick={() => setActivePost(post)}>
                  {post.imageUrl && <Image src={post.imageUrl} alt="" fill className="object-cover opacity-60" />}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="p-6 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl group-hover/poster:scale-110 transition-transform">
                      <PlayCircle size={40} fill="white" />
                    </div>
                  </div>
                </div>
              ) : (
                <YouTube
                  videoId={youtubeId}
                  opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1, autoplay: isActiveVibe ? 1 : 0, mute: !soundOn ? 1 : 0, playsinline: 1 } }}
                  className="w-full h-full"
                  onReady={onYoutubeReady}
                  onPlay={onYoutubePlay}
                  onEnd={handleEnd}
                  onError={handleYoutubeError}
                />
              )}
              {isRestricted && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                    <AlertTriangle className="text-amber-500 mb-4" size={48} />
                    <h4 className="text-white font-black text-sm uppercase tracking-[0.2em]">Restricted Vibration</h4>
                    <p className="text-slate-400 text-[10px] mt-2 max-w-xs mb-6">Owner restricted embedding. Open on YouTube to view the full vibe.</p>
                    <a href={post.mediaUrl || '#'} target="_blank" rel="noopener noreferrer" className="bg-red-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 active:scale-95">
                        <Youtube size={16} fill="white" /> Open External
                    </a>
                </div>
              )}
            </div>
          )}

          {post.mediaType === 'tiktok' && post.mediaUrl && <div className="bg-black flex items-center justify-center h-full"><TikTokEmbed url={post.mediaUrl} /></div>}

          {post.mediaType === 'video' && videoSource && (
            <div className="w-full h-full bg-black flex items-center justify-center">
              {(!reactPlayerMounted && !isActiveVibe) ? (
                <div className="absolute inset-0 cursor-pointer group/poster" onClick={() => setActivePost(post)}>
                  {post.imageUrl && <Image src={post.imageUrl} alt="" fill className="object-cover opacity-60" />}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="p-6 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl group-hover/poster:scale-110 transition-transform">
                      <PlayCircle size={40} fill="white" />
                    </div>
                  </div>
                </div>
              ) : (
                <ReactPlayer
                  url={videoSource} controls={false} width="100%" height="100%" playing={isActiveVibe} playsinline muted={!soundOn} onStart={() => setActivePost(post)} onEnd={handleEnd}
                  config={{ file: { attributes: { playsInline: true, preload: 'auto' }, forceHLS: !!post.hlsUrl, hlsConfig: { maxBufferLength: 30, startFragPrefetch: true } } }}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className={cn('flex flex-col transition-all duration-500', isActiveVibe ? 'p-10 md:flex-row md:items-start md:gap-10' : 'p-8')}>
        <div className={cn('flex-1', isActiveVibe && 'mb-8 md:mb-0')}>
          <div className="flex items-center gap-4 mb-4">
            <Avatar className={cn('border-2 border-card shadow-sm transition-all duration-500', isActiveVibe ? 'w-14 h-14' : 'w-12 h-12')}>
              <AvatarImage src={post.authorAvatarUrl} />
              <AvatarFallback className="font-black text-indigo-600">{post.authorName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn('font-black text-foreground transition-all duration-300 truncate', isActiveVibe ? 'text-lg' : 'text-base')}>
                    {post.authorName}
                </p>
                {!isAuthor && !isProcessingFollow && (
                    <button 
                        onClick={handleFollow}
                        className={cn(
                            "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 border",
                            isFollowing ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-blue-600 text-white border-blue-600 shadow-md"
                        )}
                    >
                        {isFollowing ? 'Following' : 'Follow'}
                    </button>
                )}
                {isProcessingFollow && <Loader2 className="animate-spin text-slate-300" size={10} />}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{post.campusAcronym}</p>
                <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                  <MediaTypeIcon mediaType={post.mediaType} size={12} />
                  {getMediaLabel(post.mediaType)}
                </span>
              </div>
            </div>
            
            {/* 🚀 STEP 5: CREATOR ROI QUICK-ACCESS */}
            {isAuthor && post.isPromoted && (
                <button 
                    onClick={() => setShowAnalytics(true)}
                    className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all flex items-center gap-2 pr-4"
                >
                    <BarChart3 size={18} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Analytics</span>
                </button>
            )}
          </div>

          <div className={cn('font-bold leading-snug text-foreground transition-all duration-300', isActiveVibe ? 'text-2xl md:text-3xl tracking-tight' : 'text-xl tracking-tight')}>
            {renderWithHashtags(post.content)}
          </div>

          {/* 🚀 PROMOTION DASHBOARD FOR AUTHOR */}
          {isAuthor && post.isPromoted && (
              <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border-2 border-blue-100 dark:border-blue-800 animate-in slide-in-from-bottom-2 duration-500">
                  <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                          <TrendingUp size={16} className="text-blue-600" />
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Promotion Signal</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{Math.round(promotionProgress)}% Delivered</span>
                  </div>
                  
                  <div className="h-2 w-full bg-blue-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3 shadow-inner">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-[0_0_100px_rgba(37,99,235,0.4)]" 
                        style={{ width: `${promotionProgress}%` }} 
                      />
                  </div>
                  
                  <p className="text-[9px] text-blue-800 dark:text-blue-300 font-bold italic">
                    Reached {post.promotionViewsDelivered?.toLocaleString()} of {post.promotionViewsTarget?.toLocaleString()} guaranteed citizens.
                  </p>
              </div>
          )}

          {/* 🎙️ SHOUTOUT AUDIO PLAYER */}
          {post.mediaType === 'audio' && post.mediaUrl && (
            <div className="mt-8 max-w-xl animate-in slide-in-from-bottom-2 duration-500">
                <VoicePlayer url={post.mediaUrl} duration={post.duration} theme="primary" />
                <p className="mt-3 text-[9px] font-black text-blue-500/60 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Music size={10} /> Syncing Vocal Frequency to the Yard
                </p>
            </div>
          )}

          {isActiveVibe && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <VibeReactionBar postId={post.id} post={post} />
            </div>
          )}
        </div>

        <div className={cn('flex items-center transition-all duration-300', isActiveVibe ? 'justify-between pt-0 md:flex-col md:items-end md:gap-6 md:pt-2' : 'justify-between pt-6 border-t border-border mt-6')}>
          <div className="flex items-center gap-6">
            <button onClick={handleLike} disabled={!user || isProcessingLike} className="flex flex-col items-center gap-1 group">
              <div className={cn('rounded-[1.5rem] transition-all p-3 border-2', isLiked ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-muted border-transparent text-muted-foreground group-hover:border-orange-200')}>
                <ThumbsUp size={isActiveVibe ? 24 : 20} className={cn(isLiked && 'fill-orange-600')} />
              </div>
              <span className="text-[10px] font-black text-foreground">{likeCount}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)} className="flex flex-col items-center gap-1 group">
              <div className={cn('bg-muted text-muted-foreground rounded-[1.5rem] transition-all p-3 border-2 border-transparent group-hover:border-blue-200')}>
                <MessageCircle size={isActiveVibe ? 24 : 20} />
              </div>
              <span className="text-[10px] font-black text-foreground">{post.commentCount}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {canBoost && !post.isPromoted && (
                <button onClick={() => setShowBoostDialog(true)} className="p-3 text-blue-600 hover:bg-blue-50 transition-all bg-blue-50/50 rounded-2xl hover:scale-110 active:scale-95 border-2 border-blue-100 flex items-center gap-2 pr-4 shadow-sm">
                    <Zap size={20} fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Boost Performance</span>
                </button>
            )}
            {canDelete && (
              <button type="button" onClick={handleDeletePost} className="p-3 text-muted-foreground hover:text-red-500 transition-all bg-muted/50 rounded-2xl hover:scale-110 active:scale-95 border-2 border-transparent hover:border-red-100" title="Retract">
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={handleShare} className="bg-slate-900 text-white rounded-2xl hover:bg-blue-600 p-4 transition-all shadow-xl active:scale-90 border-2 border-white/10">
              <Share2 size={24} />
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <div className={cn('border-t border-border', isActiveVibe ? 'px-10 pb-10' : 'px-8 pb-8')}>
          <CommentSection postId={post.id} authorId={post.authorId} />
        </div>
      )}

      {showBoostDialog && (
          <BoostVibeDialog post={post} isOpen={showBoostDialog} onClose={() => setShowBoostDialog(false)} />
      )}

      {showAnalytics && (
          <HighlightAnalyticsDialog post={post} isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />
      )}
    </div>
  );
}
