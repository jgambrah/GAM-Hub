'use client';

import Image from 'next/image';
import * as React from 'react';
import type { SocialPost, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Flame, ThumbsUp, MessageCircle, Share2, Zap, ShieldCheck, Loader2, XCircle } from 'lucide-react';
import { TikTokEmbed } from './tiktok-embed';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import CommentSection from './CommentSection';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';

const getYouTubeEmbedUrl = (url: string) => {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);

  if (match && match[2].length === 11) {
    const videoId = match[2];
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`;
  }
  return url;
}

type SocialPostCardProps = {
  post: SocialPost;
  author?: User;
};

export default function SocialPostCard({ post, author }: SocialPostCardProps) {
  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };
  
  const { user, isAdmin } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(post.likes);
  const [isProcessingLike, setIsProcessingLike] = React.useState(false);
  const [isBoosting, setIsBoosting] = React.useState(false);
  const [showComments, setShowComments] = React.useState(false);
  
  const isTrending = post.likes >= 20 || post.isProtected;
  const isLiaisonBoosted = post.isLiaisonBoosted;

  // LIAISON STABILIZATION: Lock embed URL to prevent iframe flickering during re-renders
  const stabilizedEmbedUrl = React.useMemo(() => {
    if (post.mediaType === 'youtube' && post.mediaUrl) {
        return getYouTubeEmbedUrl(post.mediaUrl);
    }
    if (post.mediaType === 'tiktok' && post.mediaUrl) {
        return post.mediaUrl;
    }
    return '';
  }, [post.mediaUrl, post.mediaType]);

  React.useEffect(() => {
    if (user && firestore) {
      const likeRef = doc(firestore, 'social_posts', post.id, 'likedBy', user.id);
      getDoc(likeRef).then(docSnap => {
        if (docSnap.exists()) {
          setIsLiked(true);
        }
      });
    }
  }, [firestore, user, post.id]);

  const handleLike = async () => {
    if (!user || !firestore || isProcessingLike) return;
    setIsProcessingLike(true);

    const likeRef = doc(firestore, 'social_posts', post.id, 'likedBy', user.id);
    const postRef = doc(firestore, 'social_posts', post.id);

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
        console.error("Failed to update like status:", error);
    } finally {
        setIsProcessingLike(false);
    }
  };

  const handleLiaisonBoost = async () => {
    if (!firestore || !isAdmin) return;
    setIsBoosting(true);
    const postRef = doc(firestore, "social_posts", post.id);
    try {
        await updateDoc(postRef, {
            isProtected: true,
            isLiaisonBoosted: true,
            vibeLevel: 'elite',
            boostedAt: serverTimestamp()
        });
        toast({
            title: "Vibe Boosted!",
            description: "This post has been promoted to National Level. 🔥"
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to boost post."
        });
        console.error(error);
    } finally {
        setIsBoosting(false);
    }
  };

  const handleSharePost = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || 'Check this vibe on GAM Hub!',
          text: post.content,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share failed');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Post link copied!",
        description: "The link has been copied to your clipboard.",
      });
    }
  };
  
  const authorName = post.authorName || author?.name || "Campus Member";
  const authorAvatarUrl = post.authorAvatarUrl || author?.avatarUrl;
  const authorCampus = post.campusAcronym || author?.campusId.toUpperCase() || 'GH';
  const initials = getInitials(authorName);

  return (
    <div className={cn(
        'group relative bg-card rounded-[2.5rem] border overflow-hidden transition-all duration-500 hover:shadow-2xl',
        isLiaisonBoosted ? 'ring-4 ring-amber-400/20' : 
        (isTrending ? 'border-orange-200 shadow-xl shadow-orange-50' : 'border-border shadow-sm')
    )}>
      
      {isLiaisonBoosted && (
        <div className="absolute -top-3 -right-3 z-40 bg-gradient-to-br from-amber-400 to-orange-600 text-white p-3 rounded-2xl shadow-xl rotate-12 border-4 border-card">
          <ShieldCheck size={20} className="fill-white" />
        </div>
      )}

      {/* 1. MEDIA HEADER */}
      {post.mediaType !== 'text' && (
        <div className="relative aspect-video bg-slate-900 overflow-hidden">
            {isTrending && !isLiaisonBoosted && (
                <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-full shadow-lg animate-bounce-slow">
                    <Flame size={16} className="fill-white" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Trending Vibe</span>
                </div>
            )}
            
            <div className="absolute top-4 right-4 z-30 flex gap-2">
                <div className="bg-black/20 backdrop-blur-md text-white p-2 rounded-xl border border-white/20">
                    <ShieldCheck size={14} className={isLiaisonBoosted ? 'text-amber-400' : (isTrending ? "text-orange-400" : "text-blue-400")} />
                </div>
            </div>

            {post.mediaType === 'image' && post.imageUrl && (
                <Image src={post.imageUrl} alt={post.title || "Post image"} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
            )}
            {post.mediaType === 'youtube' && stabilizedEmbedUrl && (
                <iframe src={stabilizedEmbedUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
            )}
            {post.mediaType === 'tiktok' && stabilizedEmbedUrl && (
                <div className="bg-black flex items-center justify-center h-full"><TikTokEmbed url={stabilizedEmbedUrl} /></div>
            )}
            {post.mediaType === 'video' && (
                <div className="w-full h-full flex items-center justify-center">
                    {post.mediaStatus === 'processing' ? (
                        <div className="text-white text-center">
                            <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" />
                            <p className="text-xs font-bold">Vibe is processing...</p>
                        </div>
                    ) : post.mediaUrl ? (
                        <video src={post.mediaUrl} controls className="w-full h-full" />
                    ) : (
                        <div className="text-white text-center">
                            <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                            <p className="text-xs font-bold">Video failed to process.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* 2. CONTENT AREA */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted border-2 border-card shadow-sm overflow-hidden">
               <Avatar>
                 <AvatarImage src={authorAvatarUrl} />
                 <AvatarFallback>{initials}</AvatarFallback>
               </Avatar>
            </div>
            <div>
               <p className="text-sm font-bold text-foreground">{authorName}</p>
               <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{authorCampus}</p>
            </div>
          </div>
          
          {(isTrending || isLiaisonBoosted) && (
            <div className={cn("p-2 rounded-xl shadow-inner", isLiaisonBoosted ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600')}>
               <Zap size={16} className={cn("animate-pulse", isLiaisonBoosted ? 'fill-amber-600' : 'fill-orange-600')} />
            </div>
          )}
        </div>

        <h3 className={cn(
            "text-lg font-black leading-tight mb-4",
            isLiaisonBoosted ? 'text-amber-950 dark:text-amber-200' :
            (isTrending ? 'text-orange-950 dark:text-orange-200' : 'text-foreground')
        )}>
          {isLiaisonBoosted && <span className="text-amber-600 mr-1">[Official]</span>}
          {post.title || post.content}
        </h3>

        {/* 3. INTERACTION BAR */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-4">
             <button onClick={handleLike} disabled={!user || isProcessingLike} className="flex items-center gap-1.5 group/like">
                <div className={cn(
                    "p-2 rounded-xl transition-all", 
                    isLiked ? 'bg-orange-50 text-orange-600' : 'bg-muted text-muted-foreground group-hover/like:bg-red-50 group-hover/like:text-red-500'
                )}>
                   <ThumbsUp size={18} className={isLiked ? "fill-orange-600" : ""} />
                </div>
                <span className="text-xs font-black text-foreground">{likeCount}</span>
             </button>

             <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 group/comment">
                <div className="p-2 bg-muted text-muted-foreground rounded-xl group-hover/comment:bg-blue-50 group-hover/comment:text-blue-500 transition-all">
                   <MessageCircle size={18} />
                </div>
                <span className="text-xs font-black text-foreground">{post.commentCount}</span>
             </button>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdmin && !isLiaisonBoosted && (
                <Button 
                    onClick={handleLiaisonBoost}
                    disabled={isBoosting}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1.5 group/boost p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40"
                >
                    {isBoosting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-amber-600" />}
                    <span className="text-xs font-black">Boost</span>
                </Button>
            )}

            <button onClick={handleSharePost} className="p-2 bg-foreground text-background rounded-xl hover:bg-primary transition-all shadow-lg shadow-muted">
                <Share2 size={18} />
            </button>
          </div>

        </div>
        
        {showComments && <CommentSection postId={post.id} />}
      </div>
    </div>
  );
}
