'use client';

import Image from 'next/image';
import * as React from 'react';
import type { SocialPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ThumbsUp, MessageCircle, Share2, Youtube, Play,
  Video, Trash2, Globe, AlertTriangle, FastForward, Minimize2,
  Image as ImageIcon, FileText,
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
  } = useVibePlayer();

  const [isLiked, setIsLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(post.likes);
  const [isProcessingLike, setIsProcessingLike] = React.useState(false);
  const [showComments, setShowComments] = React.useState(false);
  const [isRestricted, setIsRestricted] = React.useState(false);

  // ── YouTube state ───────────────────────────────────────────────────────────
  const ytPlayerRef = React.useRef<any>(null);
  const ytReadyRef = React.useRef(false);
  const [ytMuted, setYtMuted] = React.useState(false);

  // ── ReactPlayer state ───────────────────────────────────────────────────────
  const [reactPlayerMounted, setReactPlayerMounted] = React.useState(false);

  // ── Image/text countdown ────────────────────────────────────────────────────
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const countdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const cardRef = React.useRef<HTMLDivElement>(null);
  const hasRecordedPlay = React.useRef(false);

  const isAuthor = user?.id === post.authorId;
  const canDelete = isAuthor || isAdmin;
  const isGlobalSeed = post.campusId === 'all';
  const isActiveVibe = activePostId === post.id;
  const mediaCategory = getMediaCategory(post.mediaType);

  // ── Register ALL post types into global pool on mount ─────────────────────
  React.useEffect(() => {
    addToQueue([post]);
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mount real ReactPlayer when first activated ───────────────────────────
  React.useEffect(() => {
    if (isActiveVibe && post.mediaType === 'video') setReactPlayerMounted(true);
  }, [isActiveVibe, post.mediaType]);

  // ── Scroll into view when activated ──────────────────────────────────────
  React.useEffect(() => {
    if (isActiveVibe && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [isActiveVibe]);

  // ── Record "play" signal once per activation ───────────────────────────
  React.useEffect(() => {
    if (isActiveVibe && !hasRecordedPlay.current) {
      hasRecordedPlay.current = true;
      recordPlay(post);
    }
    if (!isActiveVibe) {
      hasRecordedPlay.current = false;
    }
  }, [isActiveVibe, post, recordPlay]);

  // ── Image/text countdown display ─────────────────────────────────────────────
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

  // ── YouTube pause when deactivated ──────────────────────────────────────────
  React.useEffect(() => {
    if (post.mediaType !== 'youtube') return;
    if (!isActiveVibe && ytReadyRef.current && ytPlayerRef.current) {
      try { ytPlayerRef.current.pauseVideo(); } catch (_) { }
    }
  }, [isActiveVibe, post.mediaType]);

  // ── Firebase like state on mount ────────────────────────────────────────────
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
      }
    } catch (error) { console.error(error); }
    finally { setIsProcessingLike(false); }
  };

  const handleDeletePost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firestore || !post.id) return;
    if (window.confirm('Are you sure you want to retract this vibe from the Yard?')) {
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
      toast({ title: 'Matching Next Vibe…', description: 'Liaison AI is keeping the Yard alive.' });
      setTimeout(() => playNext(), 500);
    }
  };

  const onYoutubeReady = (event: any) => {
    ytPlayerRef.current = event.target;
    ytReadyRef.current = true;
  };

  const onYoutubePlay = () => {
    setActivePost(post);
    if (ytMuted && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(100);
        setYtMuted(false);
      } catch (_) { }
    }
  };

  React.useEffect(() => {
    if (isActiveVibe && post.mediaType === 'youtube') setYtMuted(true);
  }, [isActiveVibe, post.mediaType]);

  const youtubeId = post.mediaType === 'youtube' ? getYouTubeId(post.mediaUrl || '') : null;
  const ytKey = `${post.id}-${isActiveVibe ? 'active' : 'idle'}`;
  const ytPlayerVars = React.useMemo(() => ({
    rel: 0, modestbranding: 1,
    autoplay: isActiveVibe ? 1 : 0,
    mute: isActiveVibe ? 1 : 0,
    playsinline: 1,
  }), [isActiveVibe]);

  const activeAspect = mediaCategory === 'video' ? 'aspect-video md:aspect-[21/9]' : 'aspect-video';

  return (
    <div
      ref={cardRef}
      data-post-id={post.id}
      className={cn(
        'group relative bg-card rounded-[2.5rem] border overflow-hidden transition-all duration-500',
        !isActiveVibe && (
          post.likes >= 20 || post.isProtected
            ? 'border-orange-200 shadow-xl shadow-orange-50'
            : 'border-border shadow-sm hover:shadow-2xl'
        ),
        isGlobalSeed && !isActiveVibe && 'border-amber-200 shadow-amber-50',
        isActiveVibe && 'border-blue-500 shadow-[0_0_60px_rgba(59,130,246,0.25)] ring-2 ring-blue-500/50 col-span-full z-10',
      )}
    >
      {isGlobalSeed && (
        <div className="absolute top-4 left-4 z-20 animate-in zoom-in duration-500">
          <div className="bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 border-2 border-white dark:border-slate-950">
            <Globe size={10} /> Global Vibe
          </div>
        </div>
      )}

      {isActiveVibe && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {isContinuous && (
            <div className="flex items-center gap-1 bg-blue-500 text-white px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest animate-pulse shadow-lg">
              <FastForward size={10} fill="white" /> ACTIVE VIBE
            </div>
          )}
          {countdown !== null && (
            <div className="bg-black/60 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black tabular-nums">
              Next in {countdown}s
            </div>
          )}
          <button
            onClick={() => setActivePost(null)}
            className="p-2 bg-black/60 backdrop-blur-sm text-white rounded-xl hover:bg-black/80 transition-all active:scale-95"
            title="Collapse"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      )}

      {post.mediaType !== 'text' && (
        <div className={cn(
          'relative bg-slate-900 overflow-hidden flex-shrink-0 transition-all duration-500 ease-in-out',
          isActiveVibe ? activeAspect : 'aspect-video group/media'
        )}>

          {/* IMAGE */}
          {post.mediaType === 'image' && post.imageUrl && (
            <Image src={post.imageUrl} alt="post" fill
              className={cn('object-cover transition-transform duration-700', !isActiveVibe && 'group-hover/media:scale-105')}
            />
          )}

          {/* YOUTUBE */}
          {post.mediaType === 'youtube' && youtubeId && (
            <div className="relative w-full h-full">
              {isRestricted ? (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                  <AlertTriangle className="text-amber-500 mb-4" size={48} />
                  <h4 className="text-white font-black text-sm uppercase tracking-widest">Restricted Vibe</h4>
                  <p className="text-slate-400 text-[10px] mt-2 max-w-[200px] mb-6">
                    Playback restricted inside other apps. Visit YouTube to see the full vibe.
                  </p>
                  <a href={post.mediaUrl || '#'} target="_blank" rel="noopener noreferrer"
                    className="bg-red-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-red-700 transition-all active:scale-95"
                  >
                    <Youtube size={14} fill="white" /> Open on YouTube
                  </a>
                </div>
              ) : (
                <YouTube
                  key={ytKey}
                  videoId={youtubeId}
                  opts={{ width: '100%', height: '100%', playerVars: ytPlayerVars }}
                  className="w-full h-full"
                  onReady={onYoutubeReady}
                  onPlay={onYoutubePlay}
                  onEnd={handleEnd}
                  onError={e => { if (e.data === 101 || e.data === 150) setIsRestricted(true); }}
                />
              )}
            </div>
          )}

          {/* TIKTOK */}
          {post.mediaType === 'tiktok' && post.mediaUrl && (
            <div className="bg-black flex items-center justify-center h-full">
              <TikTokEmbed url={post.mediaUrl} />
            </div>
          )}

          {/* NATIVE VIDEO */}
          {post.mediaType === 'video' && post.mediaUrl && (
            <div className="w-full h-full bg-black flex items-center justify-center">
              {!reactPlayerMounted && !isActiveVibe && (
                <div className="absolute inset-0 cursor-pointer group/poster" onClick={() => setActivePost(post)}>
                  {post.imageUrl && <Image src={post.imageUrl} alt="" fill className="object-cover" />}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="p-5 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl group-hover/poster:scale-110 transition-transform">
                      <Play size={32} fill="white" />
                    </div>
                  </div>
                </div>
              )}
              {(reactPlayerMounted || isActiveVibe) && (
                <ReactPlayer
                  url={post.mediaUrl} controls width="100%" height="100%"
                  playing={isActiveVibe}
                  playsinline
                  onStart={() => setActivePost(post)}
                  onEnded={handleEnd}
                  config={{ file: { attributes: { playsInline: true, preload: 'auto' } } }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Info zone ────────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-col transition-all duration-500',
        isActiveVibe ? 'p-8 md:flex-row md:items-start md:gap-8' : 'p-6'
      )}>
        <div className={cn('flex-1', isActiveVibe && 'mb-6 md:mb-0')}>
          <div className="flex items-center gap-3 mb-3">
            <Avatar className={cn('border-2 border-card shadow-sm transition-all duration-500', isActiveVibe ? 'w-12 h-12' : 'w-10 h-10')}>
              <AvatarImage src={post.authorAvatarUrl} />
              <AvatarFallback className="font-black">{post.authorName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className={cn('font-bold text-foreground transition-all duration-300', isActiveVibe ? 'text-base' : 'text-sm')}>
                {post.authorName}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{post.campusAcronym}</p>
                <span className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                  <MediaTypeIcon mediaType={post.mediaType} size={10} />
                  {getMediaLabel(post.mediaType)}
                </span>
              </div>
            </div>
            {canDelete && !isActiveVibe && (
              <button type="button" onClick={handleDeletePost}
                className="ml-auto p-2.5 text-muted-foreground hover:text-red-500 transition-all bg-muted/50 rounded-xl hover:scale-110 active:scale-95"
                title="Retract Vibe"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <h3 className={cn('font-bold leading-snug text-foreground transition-all duration-300', isActiveVibe ? 'text-xl md:text-2xl' : 'text-lg')}>
            {post.content}
          </h3>

          {isActiveVibe && (
            <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <VibeReactionBar postId={post.id} post={post} />
            </div>
          )}
        </div>

        <div className={cn(
          'flex items-center transition-all duration-300',
          isActiveVibe
            ? 'justify-between pt-0 border-t-0 md:flex-col md:items-end md:gap-4 md:pt-1'
            : 'justify-between pt-4 border-t border-border mt-4'
        )}>
          <div className="flex items-center gap-4">
            <button onClick={handleLike} disabled={!user || isProcessingLike} className="flex items-center gap-1.5">
              <div className={cn('rounded-xl transition-all', isActiveVibe ? 'p-3' : 'p-2', isLiked ? 'bg-orange-50 text-orange-600' : 'bg-muted text-muted-foreground')}>
                <ThumbsUp size={isActiveVibe ? 22 : 18} className={cn(isLiked && 'fill-orange-600')} />
              </div>
              <span className={cn('font-black text-foreground', isActiveVibe ? 'text-sm' : 'text-xs')}>{likeCount}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5">
              <div className={cn('bg-muted text-muted-foreground rounded-xl transition-all', isActiveVibe ? 'p-3' : 'p-2')}>
                <MessageCircle size={isActiveVibe ? 22 : 18} />
              </div>
              <span className={cn('font-black text-foreground', isActiveVibe ? 'text-sm' : 'text-xs')}>{post.commentCount}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && isActiveVibe && (
              <button type="button" onClick={handleDeletePost}
                className="p-2.5 text-muted-foreground hover:text-red-500 transition-all bg-muted/50 rounded-xl hover:scale-110 active:scale-95"
                title="Retract Vibe"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button className={cn('bg-foreground text-background rounded-xl hover:bg-primary transition-all shadow-lg active:scale-90', isActiveVibe ? 'p-3' : 'p-2')}>
              <Share2 size={isActiveVibe ? 22 : 18} />
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <div className={cn('border-t border-border', isActiveVibe ? 'px-8 pb-8' : 'px-6 pb-6')}>
          <CommentSection postId={post.id} />
        </div>
      )}
    </div>
  );
}
