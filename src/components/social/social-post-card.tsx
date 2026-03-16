
'use client';

import Image from 'next/image';
import * as React from 'react';
import type { SocialPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ThumbsUp, MessageCircle, Share2, Youtube, Play, PlayCircle,
  Video, Trash2, Globe, AlertTriangle, FastForward, Minimize2,
  ImageIcon, FileText, ArrowRight, Zap, Volume2, VolumeX, Mic, Music, TrendingUp, BarChart3,
  UserPlus, CheckCircle2, Gem, ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
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
import { CreatorSubscribeDialog } from './CreatorSubscribeDialog';
import { ReportContentDialog } from './ReportContentDialog';
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
  const [showSubscribe, setShowSubscribe] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [showShareMenu, setShowShareMenu] = React.useState(false);
  
  const [isSkippingRestricted, setIsSkippingRestricted] = React.useState(false);
  const [skipCountdown, setSkipCountdown] = React.useState<number | null>(null);
  const skipTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const dwellStartTimeRef = React.useRef<number | null>(null);
  const ytPlayerRef = React.useRef<any>(null);
  const ytReadyRef = React.useRef(false);

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
  const isSubscribed = user?.subscribedCreators?.includes(post.authorId) || false;
  
  const [isProcessingFollow, setIsProcessingFollow] = React.useState(false);

  const videoSource = post.hlsUrl || post.mediaUrl;
  const youtubeId = React.useMemo(() => getYouTubeId(post.mediaUrl || ''), [post.mediaUrl]);

  React.useEffect(() => {
    addToQueue([post]);
  }, [post.id, addToQueue]);

  // SCROLL TO PLAY LOGIC: TikTok-style activation
  React.useEffect(() => {
    if (!cardRef.current || !isContinuous) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isActiveVibe) {
          // If 70% visible, make this the active vibe
          setActivePost(post);
        }
      },
      { threshold: 0.7 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post, isContinuous, isActiveVibe, setActivePost]);

  // DWELL & VIEW TRACKING
  React.useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dwellStartTimeRef.current = Date.now();
        } else {
          if (dwellStartTimeRef.current) {
            const timeVisible = Date.now() - dwellStartTimeRef.current;
            // If skip logic applies
            if (timeVisible < 2000 && !isActiveVibe && !isContinuous) {
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
  }, [post, recordSkip, isActiveVibe, isContinuous]);

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
      playNext();
    }
  };

  const onYoutubeReady = React.useCallback((event: any) => {
    ytPlayerRef.current = event.target;
    ytReadyRef.current = true;
  }, []);

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

  const activeAspect = mediaCategory === 'video' ? 'aspect-video md:aspect-[21/9]' : 'aspect-video';

  if (post.status === 'under_review' && !isAdmin && !isAuthor) return null;

  return (
    <div
      ref={cardRef}
      data-post-id={post.id}
      onClick={() => { if (!isActiveVibe) setActivePost(post); }}
      className={cn(
        'group relative bg-card rounded-[3rem] border-2 overflow-hidden transition-all duration-500 cursor-pointer',
        !isActiveVibe ? 'border-border shadow-sm hover:shadow-xl' : 'border-blue-50 shadow-[0_0_80px_rgba(59,130,246,0.3)] ring-2 ring-blue-500/50 col-span-full z-10',
        isGlobalSeed && !isActiveVibe && 'border-amber-200',
        post.status === 'under_review' && 'border-red-500 bg-red-50/10'
      )}
    >
      <div 
        onClick={(e) => { 
          if(isActiveVibe && mediaCategory === 'video') {
            e.stopPropagation();
            toggleSound(); 
          }
        }}
        className={cn(
          'relative bg-slate-950 overflow-hidden flex-shrink-0 transition-all duration-700 ease-in-out',
          isActiveVibe ? activeAspect : 'aspect-video group/media'
        )}
      >
        {/* AUDIO STAGE */}
        {post.mediaType === 'audio' && post.mediaUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-12">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent)] animate-pulse" />
                <div className="relative z-10 p-10 bg-white/5 backdrop-blur-xl rounded-full border-4 border-white/10 shadow-2xl group-hover/media:scale-110 transition-transform duration-500">
                    <Mic size={64} className={cn("transition-colors", isActiveVibe ? "text-amber-400" : "text-blue-400")} />
                </div>
            </div>
        )}

        {/* PREVIEW STAGE (Inactive) */}
        {!isActiveVibe && (mediaCategory === 'video' || mediaCategory === 'image') && (
          <>
            {post.imageUrl ? (
              <Image src={post.imageUrl} alt="vibe" fill className={cn('object-cover transition-transform duration-700', 'group-hover/media:scale-105')} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white/40 gap-3">
                  <Video size={48} className="opacity-20" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Vibration Standby</span>
              </div>
            )}
            {mediaCategory === 'video' && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity">
                  <div className="p-4 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl group-hover:scale-110 transition-transform">
                      <PlayCircle size={48} className="text-white drop-shadow-xl" />
                  </div>
              </div>
            )}
          </>
        )}

        {/* PLAYER STAGE (Active) */}
        {isActiveVibe && mediaCategory === 'video' && (
            <div className="w-full h-full relative">
                {(post.mediaType === 'video' || post.mediaType === 'native') && videoSource && (
                    <ReactPlayer
                        url={videoSource} 
                        controls={false} 
                        width="100%" 
                        height="100%" 
                        playing={isActiveVibe} 
                        playsinline 
                        muted={!soundOn} 
                        onEnd={handleEnd}
                        config={{ file: { attributes: { playsInline: true, preload: 'auto' }, forceHLS: !!post.hlsUrl } }}
                    />
                )}

                {post.mediaType === 'youtube' && youtubeId && (
                    <div className="w-full h-full">
                        {isRestricted ? (
                            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                                <AlertTriangle className="text-amber-500 mb-4" size={48} />
                                <h4 className="text-white font-black text-xs uppercase tracking-[0.2em]">Restricted Signal</h4>
                                <a href={post.mediaUrl || '#'} target="_blank" rel="noopener noreferrer" className="mt-4 bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-2">
                                    <Youtube size={16} fill="white" /> Open on YouTube
                                </a>
                            </div>
                        ) : (
                            <YouTube 
                                videoId={youtubeId} 
                                opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1, autoplay: 1 } }} 
                                className="w-full h-full" 
                                onReady={onYoutubeReady}
                                onError={handleYoutubeError} 
                                onEnd={handleEnd}
                            />
                        )}
                    </div>
                )}

                {post.mediaType === 'tiktok' && (
                    <div className="bg-black h-full flex items-center justify-center py-4">
                        <TikTokEmbed url={post.mediaUrl || ''} />
                    </div>
                )}
            </div>
        )}
      </div>

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
                {isSubscribed && <Gem size={14} className="text-amber-500" />}
              </div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{post.campusAcronym}</p>
            </div>
          </div>

          <div className={cn('font-bold leading-snug text-foreground transition-all duration-300', isActiveVibe ? 'text-2xl md:text-3xl tracking-tight' : 'text-xl tracking-tight')}>
            {renderWithHashtags(post.content)}
          </div>

          {post.mediaType === 'audio' && post.mediaUrl && (
            <div className="mt-8 max-w-xl">
                <VoicePlayer url={post.mediaUrl} duration={post.duration} theme="primary" />
            </div>
          )}
        </div>

        <div className={cn('flex items-center justify-between transition-all duration-300', isActiveVibe ? 'md:flex-col md:items-end md:gap-6 pt-0' : 'pt-6 border-t border-border mt-6')}>
          <div className="flex items-center gap-6">
            <button onClick={(e) => { e.stopPropagation(); handleLike(); }} disabled={!user || isProcessingLike} className="flex flex-col items-center gap-1">
              <ThumbsUp size={20} className={cn(isLiked && 'fill-orange-600 text-orange-600')} />
              <span className="text-[10px] font-black text-foreground">{likeCount}</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="flex flex-col items-center gap-1">
              <MessageCircle size={20} className="text-muted-foreground" />
              <span className="text-[10px] font-black text-foreground">{post.commentCount}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {!isAuthor && (
                <button onClick={(e) => { e.stopPropagation(); setShowReport(true); }} className="p-3 text-muted-foreground hover:text-red-500 transition-all bg-muted/50 rounded-2xl">
                    <ShieldAlert size={20} />
                </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className="bg-slate-900 text-white rounded-2xl p-4 transition-all active:scale-90 shadow-xl">
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

      {showReport && (
          <ReportContentDialog 
            targetId={post.id} 
            targetType="post" 
            reportedUserId={post.authorId} 
            isOpen={showReport} 
            onClose={() => setShowReport(false)} 
          />
      )}
    </div>
  );
}
