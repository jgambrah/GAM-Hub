'use client';

import Image from 'next/image';
import * as React from 'react';
import type { SocialPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ThumbsUp, MessageCircle, Share2, Youtube, Play, PlayCircle,
  Video, Trash2, Globe, AlertTriangle, FastForward, Minimize2,
  ImageIcon, FileText, ArrowRight, Zap,
} from 'lucide-react';
import { TikTokEmbed } from './tiktok-embed';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/firebase';
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp,
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
import { VibeReactionBar } from './VibeReactions';
import { recordEngagement } from '@/lib/trending-service';
import { renderWithHashtags } from '@/lib/hashtag-utils';
import VibeShopOverlay from './VibeShopOverlay';

const getYouTubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

function MediaTypeIcon({ mediaType, size = 10 }: { mediaType: SocialPost['mediaType']; size?: number }) {
  if (mediaType === 'youtube') return <Youtube size={size} className="text-red-500" />;
  if (mediaType === 'tiktok' || mediaType === 'video') return <Video size={size} />;
  if (mediaType === 'image') return <ImageIcon size={size} />;
  return <FileText size={size} />;
}

export default function SocialPostCard({ post }: { post: SocialPost }) {
  const { user, isAdmin } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
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

  const isAuthor = user?.id === post.authorId;
  const canDelete = isAuthor || isAdmin;
  const isGlobalSeed = post.campusId === 'all';
  const isActiveVibe = activePostId === post.id;
  const mediaCategory = getMediaCategory(post.mediaType);

  const videoSource = post.hlsUrl || post.mediaUrl;

  React.useEffect(() => {
    addToQueue([post]);
  }, [post.id, addToQueue]);

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

  // 🏎️ ENTERPRISE SKIP DETECTION ENGINE
  React.useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dwellStartTimeRef.current = Date.now();
        } else {
          if (dwellStartTimeRef.current) {
            const timeVisible = Date.now() - dwellStartTimeRef.current;
            // 🚫 FAST SKIP PENALTY: User scrolled past in under 2 seconds
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
    if (isActiveVibe && isContinuous && mediaCategory !== 'video') {
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
      }
    } catch (error) { console.error(error); }
    finally { setIsProcessingLike(false); }
  };

  const handleShare = async () => {
    if (!firestore) return;
    recordEngagement(firestore, post.id, 'share', post.authorId, post.createdAt);
    
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

  // --- VIDEO HANDLERS ---
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

  return (
    <div
      ref={cardRef}
      data-post-id={post.id}
      className={cn(
        'group relative bg-card rounded-[3rem] border-2 overflow-hidden transition-all duration-500',
        !isActiveVibe ? 'border-border shadow-sm hover:shadow-2xl' : 'border-blue-500 shadow-[0_0_80px_rgba(59,130,246,0.3)] ring-2 ring-blue-500/50 col-span-full z-10',
        isGlobalSeed && !isActiveVibe && 'border-amber-200'
      )}
    >
      {isGlobalSeed && (
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

      {post.mediaType !== 'text' && (
        <div className={cn(
          'relative bg-slate-950 overflow-hidden flex-shrink-0 transition-all duration-700 ease-in-out',
          isActiveVibe ? activeAspect : 'aspect-video group/media'
        )}>
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
                  opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1, autoplay: isActiveVibe ? 1 : 0, mute: isActiveVibe ? 1 : 0, playsinline: 1 } }}
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
                  url={videoSource} controls width="100%" height="100%" playing={isActiveVibe} playsinline onStart={() => setActivePost(post)} onEnded={handleEnd}
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
            <div>
              <p className={cn('font-black text-foreground transition-all duration-300', isActiveVibe ? 'text-lg' : 'text-base')}>
                {post.authorName}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{post.campusAcronym}</p>
                <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                  <MediaTypeIcon mediaType={post.mediaType} size={12} />
                  {getMediaLabel(post.mediaType)}
                </span>
              </div>
            </div>
          </div>

          <div className={cn('font-bold leading-snug text-foreground transition-all duration-300', isActiveVibe ? 'text-2xl md:text-3xl tracking-tight' : 'text-xl tracking-tight')}>
            {renderWithHashtags(post.content)}
          </div>

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
    </div>
  );
}
