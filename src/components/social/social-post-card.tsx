'use client';

import Image from 'next/image';
import * as React from 'react';
import type { SocialPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ThumbsUp, MessageCircle, Share2, Youtube, Play,
  Video, Trash2, Globe, AlertTriangle, FastForward, Minimize2
} from 'lucide-react';
import { TikTokEmbed } from './tiktok-embed';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/firebase';
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import CommentSection from './CommentSection';
import ReactPlayer from 'react-player';
import YouTube from 'react-youtube';
import { useToast } from '@/hooks/use-toast';
import { useVibePlayer } from './VibePlayerContext';
import { VibeReactionBar } from './VibeReactions';

const getYouTubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export default function SocialPostCard({ post }: { post: SocialPost }) {
  const { user, isAdmin } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { activePostId, isContinuous, playNext, setActivePost, addToQueue } = useVibePlayer();

  const [isLiked, setIsLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(post.likes);
  const [isProcessingLike, setIsProcessingLike] = React.useState(false);
  const [showComments, setShowComments] = React.useState(false);
  const [isRestricted, setIsRestricted] = React.useState(false);

  const ytPlayerRef = React.useRef<any>(null);
  const ytReadyRef = React.useRef(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const isAuthor = user?.id === post.authorId;
  const canDelete = isAuthor || isAdmin;
  const isGlobalSeed = post.campusId === 'all';
  const isActiveVibe = activePostId === post.id;

  React.useEffect(() => {
    if (post.mediaType === 'youtube' || post.mediaType === 'video' || post.mediaType === 'tiktok') {
      addToQueue([post]);
    }
  }, [post.id, addToQueue]);

  React.useEffect(() => {
    if (post.mediaType !== 'youtube') return;
    if (isActiveVibe) {
      if (ytReadyRef.current && ytPlayerRef.current) {
        try { ytPlayerRef.current.playVideo(); } catch (e) { console.warn('YT play blocked:', e); }
      }
    } else {
      if (ytReadyRef.current && ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch (_) { /* ignore */ }
      }
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
      } else {
        await setDoc(likeRef, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likes: increment(1) });
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessingLike(false);
    }
  };

  const handleDeletePost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firestore || !post.id) return;
    if (window.confirm('Are you sure you want to retract this vibe from the Yard?')) {
      try {
        const collectionName = post.type === 'src_official' ? 'src_posts' : 'campus_pulse';
        await deleteDoc(doc(firestore, collectionName, post.id));
        toast({ title: 'Vibe Retracted' });
      } catch {
        toast({ variant: 'destructive', title: 'Action Denied' });
      }
    }
  };

  const handleEnd = () => {
    if (isContinuous) {
      toast({ title: 'Matching Next Vibe…' });
      setTimeout(() => playNext(), 500);
    }
  };

  const onYoutubeReady = (event: any) => {
    ytPlayerRef.current = event.target;
    ytReadyRef.current = true;
    if (isActiveVibe) {
      try { event.target.playVideo(); } catch (e) { console.warn('YT play blocked:', e); }
    }
  };

  const youtubeId = post.mediaType === 'youtube' ? getYouTubeId(post.mediaUrl || '') : null;

  return (
    <div
      ref={cardRef}
      data-post-id={post.id}
      className={cn(
        'group relative bg-card rounded-[2.5rem] border overflow-hidden transition-all duration-500 flex flex-col',
        !isActiveVibe && (
          post.likes >= 20 || post.isProtected
            ? 'border-orange-200 shadow-xl shadow-orange-50'
            : 'border-border shadow-sm hover:shadow-xl'
        ),
        isGlobalSeed && !isActiveVibe && 'border-amber-200 shadow-amber-50',
        isActiveVibe && 'border-blue-500 ring-4 ring-blue-500/20 shadow-2xl col-span-full'
      )}
    >
      {isGlobalSeed && (
        <div className="absolute top-4 left-4 z-20 animate-in zoom-in duration-500">
          <div className="bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 border-2 border-white dark:border-slate-950">
            <Globe size={10} /> Global Vibe
          </div>
        </div>
      )}

      {post.mediaType !== 'text' && (
        <div className={cn(
          "relative bg-slate-900 overflow-hidden flex-shrink-0 transition-all duration-500",
          isActiveVibe ? "aspect-video md:aspect-[21/9]" : "aspect-video"
        )}>
          {post.mediaType === 'image' && post.imageUrl && (
            <Image
              src={post.imageUrl} alt="post" fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
          )}

          {post.mediaType === 'youtube' && youtubeId && (
            <div className="relative w-full h-full">
              {isRestricted ? (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                  <AlertTriangle className="text-amber-500 mb-4" size={48} />
                  <h4 className="text-white font-black text-sm uppercase tracking-widest">Restricted Vibe</h4>
                  <p className="text-slate-400 text-[10px] mt-2 mb-6">Playback restricted. Open on YouTube to watch.</p>
                  <a
                    href={post.mediaUrl || '#'} target="_blank" rel="noopener noreferrer"
                    className="bg-red-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-red-700"
                  >
                    <Youtube size={14} fill="white" /> Open on YouTube
                  </a>
                </div>
              ) : (
                <YouTube
                  videoId={youtubeId}
                  opts={{ 
                    width: '100%', 
                    height: '100%', 
                    playerVars: { 
                      rel: 0, 
                      modestbranding: 1, 
                      autoplay: isActiveVibe ? 1 : 0 
                    } 
                  }}
                  className="w-full h-full"
                  onReady={onYoutubeReady}
                  onPlay={() => setActivePost(post)}
                  onEnd={handleEnd}
                  onError={e => { if (e.data === 101 || e.data === 150) setIsRestricted(true); }}
                />
              )}
            </div>
          )}

          {post.mediaType === 'tiktok' && post.mediaUrl && (
            <div className="bg-black flex items-center justify-center h-full">
              <TikTokEmbed url={post.mediaUrl} />
            </div>
          )}

          {post.mediaType === 'video' && post.mediaUrl && (
            <div className="w-full h-full bg-black flex items-center justify-center">
              <ReactPlayer
                url={post.mediaUrl} controls width="100%" height="100%"
                playing={isActiveVibe}
                onStart={() => setActivePost(post)}
                onEnded={handleEnd}
                light={post.imageUrl || false}
                playIcon={
                  <div className="p-5 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl hover:scale-110 transition-transform">
                    <Play size={32} fill="white" />
                  </div>
                }
              />
            </div>
          )}
        </div>
      )}

      <div className={cn("flex flex-col flex-1 transition-all duration-500", isActiveVibe ? "p-10" : "p-6")}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <Avatar className={cn("border-2 border-card shadow-sm transition-all", isActiveVibe ? "w-14 h-14" : "w-10 h-10")}>
              <AvatarImage src={post.authorAvatarUrl} />
              <AvatarFallback className="font-black">{post.authorName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className={cn("font-bold text-foreground", isActiveVibe ? "text-lg" : "text-sm")}>{post.authorName}</p>
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                  {post.campusAcronym}
                </p>
                {post.mediaType !== 'text' && (
                  <span className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                    {post.mediaType === 'youtube' ? <Youtube size={10} className="text-red-500" /> : <Video size={10} />}
                    {post.mediaType}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActiveVibe && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase animate-pulse shadow-lg">
                    <FastForward size={10} fill="white" /> ACTIVE VIBE
                </div>
                <button 
                    onClick={() => setActivePost(null)}
                    className="p-2 bg-muted hover:bg-muted/80 rounded-xl transition-all active:scale-90"
                >
                    <Minimize2 size={16} className="text-muted-foreground" />
                </button>
              </div>
            )}
            {canDelete && !isActiveVibe && (
              <button
                type="button" onClick={handleDeletePost}
                className="p-2.5 text-muted-foreground hover:text-red-500 transition-all bg-muted/50 rounded-xl hover:scale-110 active:scale-95"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <h3 className={cn("font-bold leading-snug mb-6 text-foreground flex-1", isActiveVibe ? "text-2xl" : "text-lg")}>{post.content}</h3>

        {isActiveVibe && (
          <div className="mb-8 animate-in slide-in-from-left-2 duration-500">
            <VibeReactionBar postId={post.id} />
          </div>
        )}

        <div className={cn(
            "flex items-center justify-between border-t border-border mt-auto",
            isActiveVibe ? "pt-8" : "pt-6"
        )}>
          <div className="flex items-center gap-6">
            <button onClick={handleLike} disabled={!user || isProcessingLike} className="flex items-center gap-2">
              <div className={cn('rounded-2xl transition-all', isActiveVibe ? 'p-3.5' : 'p-2', isLiked ? 'bg-orange-50 text-orange-600' : 'bg-muted text-muted-foreground')}>
                <ThumbsUp size={isActiveVibe ? 24 : 18} className={cn(isLiked && 'fill-orange-600')} />
              </div>
              <span className={cn("font-black text-foreground", isActiveVibe ? "text-base" : "text-xs")}>{likeCount}</span>
            </button>

            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2">
              <div className={cn('bg-muted text-muted-foreground rounded-2xl transition-all', isActiveVibe ? 'p-3.5' : 'p-2')}>
                <MessageCircle size={isActiveVibe ? 24 : 18} />
              </div>
              <span className={cn("font-black text-foreground", isActiveVibe ? "text-base" : "text-xs")}>{post.commentCount}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
             {canDelete && isActiveVibe && (
                <button
                    type="button" onClick={handleDeletePost}
                    className="p-3.5 text-muted-foreground hover:text-red-500 transition-all bg-muted/50 rounded-2xl hover:scale-110 active:scale-95"
                >
                    <Trash2 size={24} />
                </button>
            )}
            <button className={cn('bg-foreground text-background rounded-2xl hover:bg-primary transition-all shadow-lg active:scale-90', isActiveVibe ? 'p-3.5' : 'p-2')}>
                <Share2 size={isActiveVibe ? 24 : 18} />
            </button>
          </div>
        </div>

        {showComments && (
            <div className={cn("animate-in slide-in-from-top-4 duration-500 mt-6", isActiveVibe && "max-w-3xl mx-auto w-full")}>
                <CommentSection postId={post.id} />
            </div>
        )}
      </div>
    </div>
  );
}
