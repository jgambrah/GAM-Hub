'use client';

import Image from 'next/image';
import * as React from 'react';
import type { SocialPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, MessageCircle, Share2, Youtube, Play, Video, Trash2, Globe, AlertTriangle } from 'lucide-react';
import { TikTokEmbed } from './tiktok-embed';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import CommentSection from './CommentSection';
import ReactPlayer from 'react-player';
import YouTube, { type YouTubeProps } from 'react-youtube';
import { useToast } from '@/hooks/use-toast';

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
  const [isLiked, setIsLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(post.likes);
  const [isProcessingLike, setIsProcessingLike] = React.useState(false);
  const [showComments, setShowComments] = React.useState(false);
  const [isRestricted, setIsRestricted] = React.useState(false);
  
  const isTrending = likeCount >= 20 || post.isProtected;
  const isAuthor = user?.id === post.authorId;
  const canDelete = isAuthor || isAdmin;
  const isGlobalSeed = post.campusId === 'all';

  React.useEffect(() => {
    if (user && firestore) {
      const likeRef = doc(firestore, 'campus_pulse', post.id, 'likedBy', user.id);
      getDoc(likeRef).then(docSnap => {
        if (docSnap.exists()) setIsLiked(true);
      });
    }
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

    if (window.confirm("Are you sure you want to retract this vibe from the Yard?")) {
      try {
        const collectionName = post.type === 'src_official' ? 'src_posts' : 'campus_pulse';
        const postRef = doc(firestore, collectionName, post.id);
        await deleteDoc(postRef);
        toast({ title: "Vibe Retracted" });
      } catch (error: any) {
        toast({ variant: 'destructive', title: "Action Denied" });
      }
    }
  };

  const onYoutubeError = (event: any) => {
    // 101 and 150 mean the video owner restricted embedding
    if (event.data === 101 || event.data === 150) {
      setIsRestricted(true);
    }
  };

  const youtubeId = post.mediaType === 'youtube' ? getYouTubeId(post.mediaUrl || '') : null;

  return (
    <div className={cn(
        'group relative bg-card rounded-[2.5rem] border overflow-hidden transition-all duration-500 hover:shadow-2xl h-full',
        isTrending ? 'border-orange-200 shadow-xl shadow-orange-50' : 'border-border shadow-sm',
        isGlobalSeed && 'border-amber-200 shadow-amber-50'
    )}>
      {isGlobalSeed && (
        <div className="absolute top-4 left-4 z-20 animate-in zoom-in duration-500">
          <div className="bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 border-2 border-white dark:border-slate-950">
            <Globe size={10} /> Global Vibe
          </div>
        </div>
      )}

      {post.mediaType !== 'text' && (
        <div className="relative aspect-video bg-slate-900 overflow-hidden group/media">
            {post.mediaType === 'image' && post.imageUrl && (
                <Image src={post.imageUrl} alt="post" fill className="object-cover group-hover/media:scale-105 transition-transform duration-700" />
            )}
            
            {post.mediaType === 'youtube' && youtubeId && (
                <div className="relative w-full h-full">
                  {isRestricted ? (
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                        <AlertTriangle className="text-amber-500 mb-4" size={48} />
                        <h4 className="text-white font-black text-sm uppercase tracking-widest">Restricted Vibe</h4>
                        <p className="text-slate-400 text-[10px] mt-2 max-w-[200px] mb-6">This creator has blocked playback inside other apps. Visit YouTube to see the full vibe.</p>
                        <a 
                            href={post.mediaUrl || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-red-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-red-700 transition-all active:scale-95"
                        >
                            <Youtube size={14} fill="white" /> Open on YouTube
                        </a>
                    </div>
                  ) : (
                    <YouTube 
                        videoId={youtubeId}
                        opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 } }}
                        className="w-full h-full"
                        onError={onYoutubeError}
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
                        url={post.mediaUrl} 
                        controls 
                        width="100%" 
                        height="100%" 
                        light={post.imageUrl || false}
                        playIcon={<div className="p-5 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl hover:scale-110 transition-transform"><Play size={32} fill="white" /></div>}
                    />
                </div>
            )}
        </div>
      )}

      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-card shadow-sm">
                <AvatarImage src={post.authorAvatarUrl} />
                <AvatarFallback className="font-black">{post.authorName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
               <p className="text-sm font-bold text-foreground">{post.authorName}</p>
               <div className="flex items-center gap-2">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{post.campusAcronym}</p>
                  {post.mediaType !== 'text' && (
                      <span className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                          {post.mediaType === 'youtube' ? <Youtube size={10} className="text-red-500" /> : <Video size={10} />} 
                          {post.mediaType}
                      </span>
                  )}
               </div>
            </div>
          </div>

          {canDelete && (
            <button 
              type="button"
              onClick={handleDeletePost}
              className="p-2.5 text-muted-foreground hover:text-red-500 transition-all bg-muted/50 rounded-xl hover:scale-110 active:scale-95"
              title="Retract Vibe"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <h3 className="text-lg font-bold leading-snug mb-4 text-foreground">{post.content}</h3>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-4">
             <button onClick={handleLike} disabled={!user || isProcessingLike} className="flex items-center gap-1.5 group/like">
                <div className={cn("p-2 rounded-xl transition-all", isLiked ? 'bg-orange-50 text-orange-600' : 'bg-muted text-muted-foreground')}>
                   <ThumbsUp size={18} className={cn(isLiked && "fill-orange-600")} />
                </div>
                <span className="text-xs font-black text-foreground">{likeCount}</span>
             </button>

             <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 group/comment">
                <div className="p-2 bg-muted text-muted-foreground rounded-xl">
                   <MessageCircle size={18} />
                </div>
                <span className="text-xs font-black text-foreground">{post.commentCount}</span>
             </button>
          </div>
          <button className="p-2 bg-foreground text-background rounded-xl hover:bg-primary transition-all shadow-lg active:scale-90"><Share2 size={18} /></button>
        </div>
        
        {showComments && <CommentSection postId={post.id} />}
      </div>
    </div>
  );
}
