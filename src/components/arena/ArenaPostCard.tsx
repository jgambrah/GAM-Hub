
'use client';

import React, { useState, useMemo } from 'react';
import type { ArenaPost } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { 
    Flame, ThumbsUp, MessageSquare, Zap, ShieldAlert, Bot, Trash2, Youtube, 
    AlertTriangle, Mic, Music, Target, Trophy, PlayCircle, Crown, Smile, Swords, 
    Share2, Copy, Send as SendIcon, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import ArenaComebacks from '../social/ArenaComebacks';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import YouTube from 'react-youtube';
import ReactPlayer from 'react-player';
import VoicePlayer from '../social/VoicePlayer';
import dynamic from 'next/dynamic';

const TikTokEmbed = dynamic(() => import('../social/tiktok-embed').then(mod => mod.TikTokEmbed), {
  ssr: false,
  loading: () => <div className="h-[500px] w-[325px] bg-muted animate-pulse rounded-lg mx-auto" />
});

const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

const getCategoryLabel = (category: string) => {
    switch (category) {
        case 'savage_roast': return { label: 'SAVAGE ROAST', icon: Flame, color: 'bg-red-600' };
        case 'funniest_comeback': return { label: 'FUNNIEST COMEBACK', icon: Smile, color: 'bg-orange-500' };
        case 'crowd_favorite': return { label: 'CROWD FAVORITE', icon: Star, color: 'bg-amber-500' };
        case 'knockout_moment': return { label: 'KNOCKOUT MOMENT', icon: Zap, color: 'bg-indigo-600' };
        default: return { label: 'BATTLE REPLAY', icon: Trophy, color: 'bg-slate-700' };
    }
}

export const ArenaPostCard = React.memo(function ArenaPostCard({ post }: { post: ArenaPost }) {
    const { user, isAdmin } = useAuth();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [localStats, setLocalStats] = React.useState({ ...post.stats, comebacks: post.comebackCount || 0 });
    const [userAction, setUserAction] = React.useState<'liked' | 'burned' | null>(null);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [showComebacks, setShowComments] = useState(false);
    const [isRestricted, setIsRestricted] = React.useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);

    const isBlocked = post.status === 'blocked';
    const isAuthor = user?.id === post.authorId;
    const canDelete = isAuthor || isAdmin;
    const isShade = post.vibeType === 'shade';
    const isHighlight = post.type === 'arena_highlight';

    const videoSource = post.hlsUrl || post.mediaUrl;
    const youtubeId = useMemo(() => isBlocked ? null : getYouTubeId(post.mediaUrl || ''), [post.mediaUrl, isBlocked]);

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
        } finally {
            setIsProcessing(false);
        }
    };

    const handleShare = (platform: 'whatsapp' | 'copy' | 'native') => {
        const shareUrl = `${window.location.origin}/pulse?postId=${post.id}`;
        const shareText = isHighlight 
            ? `🔥 Arena Highlight: ${post.authorName} killed it in the Yard! Check this out:` 
            : `Vibe check in the Yard!`;

        if (platform === 'whatsapp') {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, '_blank');
        } else if (platform === 'copy') {
            navigator.clipboard.writeText(shareUrl);
            toast({ title: "Link Copied!", description: "Vibe link added to your clipboard." });
        } else if (platform === 'native' && navigator.share) {
            navigator.share({ title: 'GAM Hub Vibe', text: shareText, url: shareUrl });
        }
        setShowShareMenu(false);
    };

    const catInfo = isHighlight && post.battleMetadata?.category ? getCategoryLabel(post.battleMetadata.category) : null;

    return (
        <div className={cn(
            "relative bg-card rounded-[3rem] p-8 border-l-8 shadow-2xl transition-all duration-500 overflow-hidden",
            isBlocked ? "border-red-600 bg-red-50 dark:bg-red-950/10" : isHighlight ? "border-amber-500 bg-gradient-to-br from-slate-900 to-slate-950 text-white" : isShade ? "border-red-500 bg-gradient-to-br from-white to-red-50/30" : "border-amber-500 bg-gradient-to-br from-white to-amber-50/30"
        )}>
            {isHighlight && (
                <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-2 animate-in zoom-in duration-500">
                    <div className="bg-amber-500 text-slate-950 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border-2 border-white/20">
                        <Trophy size={12} fill="currentColor" /> Winning Performance
                    </div>
                    {catInfo && (
                        <div className={cn(catInfo.color, "text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5")}>
                            <catInfo.icon size={10} fill="currentColor" /> {catInfo.label}
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden flex-shrink-0" 
                        style={{ backgroundColor: isBlocked ? "#dc2626" : post.authorColor }}>
                        <Image src={post.authorAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${post.authorName}`} width={48} height={48} alt="avatar" className="object-cover w-full h-full"/>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className={cn("text-base font-black leading-none", isHighlight ? "text-white" : "text-foreground")}>
                                {post.authorName} 
                            </p>
                            {isHighlight ? <Crown size={14} className="text-amber-500 fill-amber-500" /> : isShade ? <Flame size={14} className="text-red-500 fill-current" /> : <Trophy size={14} className="text-amber-500" />}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5 flex items-center gap-3">
                           <span className={cn("px-2 py-0.5 rounded-lg text-white font-black")} style={{backgroundColor: post.authorColor}}>
                               {post.authorAcronym || post.authorCampus}
                           </span>
                           {isHighlight && (
                               <div className="flex items-center gap-1.5 text-amber-400">
                                    <Zap size={10} fill="currentColor" />
                                    <span className="font-black">PEAK ENERGY: {post.battleMetadata?.totalEnergy || 0}</span>
                               </div>
                           )}
                        </div>
                    </div>
                </div>
                
                {post.createdAt && (
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest bg-muted/30 px-3 py-1 rounded-full">
                        {formatDistanceToNow(new Date(post.createdAt?.toDate?.() || post.createdAt), { addSuffix: true })}
                    </p>
                )}
            </div>
            
            <div className="relative z-10 space-y-6">
                {post.content && (
                    <p className={cn(
                        "text-xl font-black leading-tight tracking-tight",
                        isHighlight ? "text-indigo-50" : isShade ? "text-slate-900" : "text-amber-900"
                    )}>
                        "{post.content}"
                    </p>
                )}
                
                {post.mediaUrl && (
                    <div className="rounded-[2.5rem] overflow-hidden bg-black border-4 border-white dark:border-slate-800 shadow-2xl relative group/media">
                        {post.mediaType === 'image' && <Image src={post.mediaUrl} width={600} height={400} className="w-full h-auto object-cover" alt="Arena Visual" />}
                        
                        {(post.mediaType === 'video' || post.mediaType === 'native') && videoSource && (
                            <div className="aspect-video">
                                <ReactPlayer url={videoSource} controls playing={false} width="100%" height="100%" playsinline />
                            </div>
                        )}

                        {post.mediaType === 'youtube' && youtubeId && (
                            <div className="relative w-full aspect-video">
                                <YouTube videoId={youtubeId} opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 } }} className="w-full h-full" />
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-4 pt-4">
                    <button
                        onClick={() => handleAction(isShade ? 'burn' : 'like')}
                        disabled={isProcessing}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-90 border-2",
                            isHighlight ? "bg-amber-500 text-slate-950 border-amber-500" : isShade 
                                ? (userAction === 'burned' ? "bg-red-600 text-white border-red-600 shadow-xl shadow-red-200" : "bg-red-50 border-red-100 text-red-600 hover:bg-red-100")
                                : (userAction === 'liked' ? "bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-200" : "bg-amber-100 border-amber-100 text-amber-600 hover:bg-amber-100")
                        )}
                    >
                        {isShade ? <Flame size={16} className={cn(userAction === 'burned' && "fill-current")} /> : <ThumbsUp size={16} className={cn(userAction === 'liked' && "fill-current")} />}
                        <span>{isShade ? `${localStats?.burns || 0} Burns` : `${localStats?.likes || 0} Vibes`}</span>
                    </button>
                    
                    <button 
                        onClick={() => setShowComments(!showComebacks)} 
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all",
                            isHighlight ? "bg-white/10 text-white border-white/20" : showComebacks ? "bg-slate-900 text-white border-slate-900 shadow-xl" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                        )}
                    >
                        <MessageSquare size={16} /> 
                        <span>{localStats.comebacks || 0} Comebacks</span>
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setShowShareMenu(!showShareMenu)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all active:scale-90",
                                isHighlight ? "bg-white/10 text-white border-white/20 hover:bg-white/20" : "bg-slate-900 text-white border-slate-900 shadow-xl"
                            )}
                        >
                            <Share2 size={16} /> Viral Share
                        </button>

                        {showShareMenu && (
                            <div className="absolute bottom-full mb-4 left-0 w-48 bg-card border-2 border-border rounded-3xl shadow-2xl p-2 z-[100] animate-in slide-in-from-bottom-2">
                                <button onClick={() => handleShare('whatsapp')} className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-2xl text-xs font-black uppercase transition-all">
                                    <div className="p-2 bg-green-500 text-white rounded-lg"><SendIcon size={14} /></div> WhatsApp
                                </button>
                                <button onClick={() => handleShare('copy')} className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-2xl text-xs font-black uppercase transition-all">
                                    <div className="p-2 bg-blue-500 text-white rounded-lg"><Copy size={14} /></div> Copy Link
                                </button>
                                {navigator.share && (
                                    <button onClick={() => handleShare('native')} className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-2xl text-xs font-black uppercase transition-all">
                                        <div className="p-2 bg-indigo-500 text-white rounded-lg"><Share2 size={14} /></div> More...
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showComebacks && user && (
              <ArenaComebacks post={post} />
            )}
        </div>
    )
});
