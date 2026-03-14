'use client';

import React, { useState, useMemo } from 'react';
import type { ArenaPost } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { Flame, ThumbsUp, MessageSquare, Zap, ShieldAlert, Bot, Trash2, Youtube, AlertTriangle, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import ArenaComebacks from '../social/ArenaComebacks';
import Image from 'next/image';
import { TikTokEmbed } from '../social/tiktok-embed';
import { useToast } from '@/hooks/use-toast';
import YouTube from 'react-youtube';
import ReactPlayer from 'react-player';
import VoicePlayer from '../social/VoicePlayer';

const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

export function ArenaPostCard({ post }: { post: ArenaPost }) {
    const { user, isAdmin } = useAuth();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [localStats, setLocalStats] = React.useState({ ...post.stats, comebacks: post.comebackCount || 0 });
    const [userAction, setUserAction] = React.useState<'liked' | 'burned' | null>(null);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [showComebacks, setShowComments] = useState(false);
    const [isRestricted, setIsRestricted] = useState(false);

    const isBlocked = post.status === 'blocked';
    const isAuthor = user?.id === post.authorId;
    const canDelete = isAuthor || isAdmin;

    // Use HLS playlist if available for adaptive streaming
    const videoSource = post.hlsUrl || post.mediaUrl;
    const youtubeId = useMemo(() => isBlocked ? null : getYouTubeId(post.mediaUrl || ''), [post.mediaUrl, isBlocked]);

    React.useEffect(() => {
        setLocalStats({ ...post.stats, comebacks: post.comebackCount || 0 });
    }, [post.stats, post.comebackCount]);

    React.useEffect(() => {
        if (user && firestore) {
            const likeRef = doc(firestore, 'campus_pulse', post.id, 'likedBy', user.id);
            const burnRef = doc(firestore, 'campus_pulse', post.id, 'burnedBy', user.id);

            getDoc(likeRef).then(doc => { if (doc.exists()) setUserAction('liked') });
            getDoc(burnRef).then(doc => { if (doc.exists()) setUserAction('burned') });
        }
    }, [user, firestore, post.id]);

    const handleAction = async (action: 'like' | 'burn') => {
        if (!user || !firestore || isProcessing || isBlocked) return;
        setIsProcessing(true);

        const postRef = doc(firestore, 'campus_pulse', post.id);
        const likeRef = doc(firestore, 'campus_pulse', post.id, 'likedBy', user.id);
        const burnRef = doc(firestore, 'campus_pulse', post.id, 'burnedBy', user.id);
        
        let newAction: 'liked' | 'burned' | null = null;
        if (userAction === (action === 'like' ? 'liked' : 'burned')) {
            newAction = null;
        } else {
            newAction = (action === 'like' ? 'liked' : 'burned');
        }

        const statsUpdate: any = {};
        if (userAction === 'liked') statsUpdate['stats.likes'] = -1;
        if (userAction === 'burned') statsUpdate['stats.burns'] = -1;
        if (newAction === 'liked') statsUpdate['stats.likes'] = (statsUpdate['stats.likes'] || 0) + 1;
        if (newAction === 'burned') statsUpdate['stats.burns'] = (statsUpdate['stats.burns'] || 0) + 1;

        setLocalStats(prev => ({
            ...prev,
            likes: (prev?.likes || 0) + (statsUpdate['stats.likes'] || 0),
            burns: (prev?.burns || 0) + (statsUpdate['stats.burns'] || 0),
        }));
        setUserAction(newAction);

        try {
            if (userAction === 'liked') await deleteDoc(likeRef);
            if (userAction === 'burned') await deleteDoc(burnRef);
            if (newAction === 'liked') await setDoc(likeRef, { timestamp: serverTimestamp() });
            if (newAction === 'burned') await setDoc(burnRef, { timestamp: serverTimestamp() });
            
            const finalUpdate: any = {};
            if(statsUpdate['stats.likes']) finalUpdate['stats.likes'] = increment(statsUpdate['stats.likes']);
            if(statsUpdate['stats.burns']) finalUpdate['stats.burns'] = increment(statsUpdate['stats.burns']);
            
            if (Object.keys(finalUpdate).length > 0) {
                 await updateDoc(postRef, finalUpdate);
            }

        } catch (error) {
            console.error("Failed to update post stats:", error);
            setLocalStats({ ...post.stats, comebacks: post.comebackCount || 0 });
            setUserAction(userAction);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeletePost = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!firestore || !post.id) return;

        if (window.confirm("Are you sure you want to retract this vibration from The Arena?")) {
            try {
                const postRef = doc(firestore, 'campus_pulse', post.id);
                await deleteDoc(postRef);
                toast({ title: "Vibe Retracted" });
            } catch (err: any) {
                toast({ variant: 'destructive', title: "Action Blocked" });
            }
        }
    };

    const onYoutubeError = (event: any) => {
        if (event.data === 101 || event.data === 150) {
            setIsRestricted(true);
        }
    };

    const isShade = post.vibeType === 'shade';

    return (
        <div className={cn(
            "relative bg-card rounded-[2.5rem] p-6 border-l-8 shadow-sm transition-all",
            isBlocked ? "border-red-600 bg-red-50 dark:bg-red-950/10" : ""
        )} style={{ borderLeftColor: isBlocked ? undefined : post.authorColor }}>
            
            {isBlocked && (
                <div className="absolute top-0 right-0 p-4">
                    <ShieldAlert className="text-red-600 animate-pulse" size={24} />
                </div>
            )}

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white dark:border-card shadow-sm overflow-hidden" 
                        style={{ backgroundColor: isBlocked ? "#dc2626" : post.authorColor }}>
                        {isBlocked ? (
                            <div className="w-full h-full flex items-center justify-center bg-red-600 text-white">
                                <ShieldAlert size={20} />
                            </div>
                        ) : (
                            <Image src={post.authorAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${post.authorName}`} width={40} height={40} alt="avatar" className="object-cover w-full h-full"/>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-black text-foreground leading-none flex items-center">
                        {isBlocked ? "Liaison Moderator" : post.authorName} 
                        {!isBlocked && post.authorId === 'xYAuFJclD2UiUwPAUb4vqEaaKct2' && <span className="ml-1 text-blue-500 font-bold text-[10px]">(Liaison)</span>}
                        </p>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-2">
                           <span className={cn("px-1.5 py-0.5 rounded text-white", isBlocked ? "bg-red-600" : "")} style={{backgroundColor: isBlocked ? undefined : post.authorColor}}>{isBlocked ? "SHIELD" : post.authorCampus}</span>
                           {!isBlocked && post.targetCampus && (
                               <>
                                <Zap size={12} className="text-muted-foreground" />
                                <span className="tracking-widest">
                                    TARGET: {post.targetCampus}
                                </span>
                               </>
                           )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
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
                    {post.createdAt && (
                        <p className="text-[10px] text-muted-foreground font-bold flex-shrink-0">
                            {formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true })}
                        </p>
                    )}
                </div>
            </div>
            
            {isBlocked ? (
                <div className="py-4 space-y-3">
                    <p className="text-lg font-black text-red-600 italic">
                        {post.content}
                    </p>
                    {post.moderationNote && (
                        <p className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                            <Bot size={14} /> Reason: {post.moderationNote}
                        </p>
                    )}
                </div>
            ) : (
                <>
                    {post.content && <p className="text-lg font-bold text-foreground leading-tight">"{post.content}"</p>}
                    
                    {post.mediaType === 'audio' && post.mediaUrl && (
                        <div className="mt-4 p-6 bg-slate-900 rounded-3xl border-2 border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><Mic size={80} className="text-blue-400" /></div>
                            <VoicePlayer url={post.mediaUrl} duration={post.duration} theme="dark" />
                        </div>
                    )}

                    {post.mediaUrl && post.mediaType !== 'audio' && (
                        <div className="mt-4 rounded-2xl overflow-hidden bg-black border border-border group/media relative">
                            {post.mediaType === 'image' && <Image src={post.mediaUrl} width={500} height={300} className="w-full h-auto object-cover" alt="Post media" />}
                            
                            {(post.mediaType === 'video' || post.mediaType === 'native') && videoSource && (
                                <div className="aspect-video bg-black">
                                    <ReactPlayer 
                                        url={videoSource}
                                        controls
                                        width="100%"
                                        height="100%"
                                        playsinline
                                        config={{
                                            file: {
                                                attributes: { playsInline: true, preload: 'auto' },
                                                forceHLS: !!post.hlsUrl
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {post.mediaType === 'youtube' && youtubeId && (
                                <div className="relative w-full aspect-video">
                                    {isRestricted ? (
                                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                                            <AlertTriangle className="text-amber-500 mb-2" size={32} />
                                            <h4 className="text-white font-black text-[10px] uppercase tracking-widest">Restricted Entry</h4>
                                            <p className="text-slate-400 text-[8px] mt-1 mb-4">Embedding blocked by owner. Visit YouTube to see the full shade.</p>
                                            <a 
                                                href={post.mediaUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="bg-red-600 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-red-700"
                                            >
                                                <Youtube size={12} fill="white" /> Open on YouTube
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
                            {post.mediaType === 'tiktok' && <div className="bg-black flex justify-center"><TikTokEmbed url={post.mediaUrl} /></div>}
                        </div>
                    )}

                    <div className="flex gap-4 mt-6">
                        <button
                            onClick={() => handleAction(isShade ? 'burn' : 'like')}
                            disabled={isProcessing}
                            className={cn(
                                "flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors",
                                isShade && userAction === 'burned' && 'text-red-500',
                                !isShade && userAction === 'liked' && 'text-blue-500'
                            )}
                        >
                            {isShade ? <Flame size={16} className={cn(userAction === 'burned' && "fill-current")} /> : <ThumbsUp size={16} className={cn(userAction === 'liked' && "fill-current")} />}
                            <span className="text-xs font-black">
                                {isShade ? `${localStats?.burns || 0} Burns` : `${localStats?.likes || 0} Likes`}
                            </span>
                        </button>
                        <button onClick={() => setShowComments(!showComebacks)} className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-500 transition-colors">
                            <MessageSquare size={16} /> <span className="text-xs font-black">{localStats.comebacks || 0} Comebacks</span>
                        </button>
                    </div>
                </>
            )}

            {showComebacks && user && (
              <ArenaComebacks post={post} />
            )}
        </div>
    )
}
