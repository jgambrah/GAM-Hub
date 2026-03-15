'use client';

/**
 * @fileOverview Arena Comebacks Component.
 * Restored multimedia response engine for asynchronous battle vibrations.
 * Includes handleFileChange logic, AI Referee integration, 
 * anti-spam cooldowns, and content moderation guards.
 */

import React, { useState, useRef, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, increment, getDoc, setDoc, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { ArenaPost, ArenaComeback } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { campuses } from '@/lib/data';
import { 
    Send, Zap, Loader2, Smile, ImagePlus, X, Youtube, Bot, 
    ShieldCheck, AlertTriangle, Scale, ShieldAlert 
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import YouTube from 'react-youtube';
import { getBattleVerdict } from '@/ai/flows/arena-referee-flow';
import dynamic from 'next/dynamic';

const TikTokEmbed = dynamic(() => import('./tiktok-embed').then(mod => mod.TikTokEmbed), {
  ssr: false,
  loading: () => <div className="h-60 w-[325px] bg-muted animate-pulse rounded-lg mx-auto" />
});

const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function ComebackItem({ c, onReply }: { c: ArenaComeback, onReply: (name: string) => void }) {
    const [isRestricted, setIsRestricted] = useState(false);
    const youtubeId = useMemo(() => c.mediaType === 'youtube' ? getYouTubeId(c.mediaUrl || '') : null, [c.mediaUrl, c.mediaType]);
    const isReply = !c.isBot && c.text && c.text.startsWith('@');

    if (c.isBot) {
        return (
            <div className="flex flex-col items-center my-8 animate-in zoom-in duration-500">
                <div className="bg-slate-950 text-amber-400 p-8 rounded-[3rem] border-4 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.2)] max-w-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Scale size={120}/></div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500 rounded-xl text-slate-950 shadow-lg animate-bounce">
                                <Bot size={20} />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Liaison AI Referee</span>
                                <div className="flex gap-1 mt-1">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="w-1 h-1 rounded-full bg-amber-500/40" />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 text-[8px] font-black uppercase tracking-widest">
                            Official Verdict
                        </div>
                    </div>
                    <p className="text-lg font-black italic leading-tight text-white mb-4">
                        "{c.text}"
                    </p>
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic">Justice served in the Yard ⚖️</p>
                        <ShieldCheck size={14} className="text-amber-500 opacity-50" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full group/comeback animate-in fade-in slide-in-from-bottom-2", isReply && "pl-8")}>
            <div className="flex items-center gap-2 mb-2 px-2">
                <span className="text-[9px] font-black text-white px-2.5 py-1 rounded-lg uppercase shadow-sm" style={{ backgroundColor: c.authorColor }}>
                    {c.authorCampus}
                </span>
                {c.isCounter && (
                    <span className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded-full">
                        <Zap size={10} fill="currentColor" /> Counter-Strike
                    </span>
                )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-[1.8rem] border border-slate-100 dark:border-border shadow-sm group-hover/comeback:shadow-lg transition-all relative">
                {c.mediaUrl && (
                    <div className="mb-4 rounded-[1.5rem] overflow-hidden bg-black border-2 border-white shadow-inner relative group/media">
                        {c.mediaType === 'image' && <Image src={c.mediaUrl} width={400} height={300} className="w-full h-auto object-cover max-h-60" alt="vibe evidence" data-ai-hint="battle evidence" />}
                        {c.mediaType === 'video' && <video src={c.mediaUrl} controls className="w-full max-h-60" />}
                        {c.mediaType === 'youtube' && youtubeId && (
                            <div className="relative w-full aspect-video">
                                {isRestricted ? (
                                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                                        <AlertTriangle className="text-amber-500 mb-2" size={24} />
                                        <a href={c.mediaUrl} target="_blank" rel="noopener noreferrer" className="bg-red-600 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-lg flex items-center gap-1.5 hover:bg-red-700">
                                            <Youtube size={12} fill="white" /> View Source
                                        </a>
                                    </div>
                                ) : (
                                    <YouTube videoId={youtubeId} opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 } }} className="w-full h-full" onError={() => setIsRestricted(true)} />
                                )}
                            </div>
                        )}
                        {c.mediaType === 'tiktok' && <div className="bg-black flex justify-center py-2"><TikTokEmbed url={c.mediaUrl} /></div>}
                    </div>
                )}

                {c.text && (
                    <p className={cn(
                        "text-base text-slate-900 dark:text-slate-100 font-bold leading-tight",
                        isReply && "text-slate-600 dark:text-slate-400"
                    )}>
                        {c.text}
                    </p>
                )}
            </div>

            <div className="flex justify-end pt-1 pr-4">
                <button onClick={() => onReply(c.authorName)} className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest opacity-0 group-hover/comeback:opacity-100 transition-opacity">
                    Reply
                </button>
            </div>
        </div>
    );
}

export default function ArenaComebacks({ post }: { post: ArenaPost }) {
  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRefereeing, setIsRefereeing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  const { firestore, storage } = useFirebase();
  const { user: userProfile } = useAuth();
  const { toast } = useToast();

  const comebacksQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'campus_pulse', post.id, 'comebacks'), 
        orderBy('createdAt', 'asc'),
        limit(200)
    );
  }, [firestore, post.id]);

  const { data: comebacks, isLoading } = useCollection<ArenaComeback>(comebacksQuery);

  const resetInputs = () => {
    setText(''); setVideoUrl(''); setShowUrlInput(false); setShowEmojiPicker(false); setFile(null); setPreviewUrl(null);
    setUploadProgress(0);
    if(fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
            variant: "destructive",
            title: "File too large",
            description: "Maximum upload size is 10MB"
        });
        return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !videoUrl.trim() && !file) || !firestore || !storage || !userProfile) return;

    const bannedWords = ["slur1", "slur2"];
    if (bannedWords.some(word => text.toLowerCase().includes(word))) {
        toast({
            variant: "destructive",
            title: "Content blocked",
            description: "Your comeback violates Arena rules. Keep it witty, not abusive."
        });
        return;
    }

    const lastReplyRef = doc(firestore, "users", userProfile.id, "rateLimits", "arenaReply");
    const lastSnap = await getDoc(lastReplyRef);

    if (lastSnap.exists()) {
        const lastTime = lastSnap.data().time?.toMillis?.() || 0;
        const now = Date.now();

        if (now - lastTime < 5000) {
            toast({
                variant: "destructive",
                title: "Slow down!",
                description: "Wait a few seconds before posting another comeback."
            });
            return;
        }
    }

    setIsPosting(true);
    setUploadProgress(0);

    const userCampusInfo = campuses.find(c => c.id === userProfile.campusId);
    const authorColor = userCampusInfo?.primaryColor || "#0f172a";
    const isCounter = userProfile.campusId ? (campuses.find(c => c.id === userProfile.campusId)?.acronym !== post.authorCampus) : false;

    try {
      let comebackData: any = {
        text: text.trim(),
        authorId: userProfile.id,
        authorName: userProfile.name || "Campus Member",
        authorCampus: userCampusInfo?.acronym || 'GH',
        authorColor: authorColor,
        isCounter: isCounter,
        createdAt: serverTimestamp()
      };

      if (file) {
        const filePath = `arena_media/${post.id}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        
        const uploadTask = uploadBytesResumable(fileRef, file);

        await new Promise((resolve, reject) => {
            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                reject,
                () => resolve(null)
            );
        });

        comebackData.mediaUrl = await getDownloadURL(fileRef);
        comebackData.mediaType = file.type.startsWith('image') ? 'image' : 'video';
      } else if (videoUrl.trim()) {
        comebackData.mediaUrl = videoUrl.trim();
        comebackData.mediaType = videoUrl.includes('youtube') || videoUrl.includes('youtu.be') ? 'youtube' : 'tiktok';
      }
      
      await addDocumentNonBlocking(collection(firestore, 'campus_pulse', post.id, 'comebacks'), comebackData);
      await updateDocumentNonBlocking(doc(firestore, 'campus_pulse', post.id), { comebackCount: increment(1) });
      
      await setDoc(lastReplyRef, { time: serverTimestamp() });

      toast({ title: 'Comeback Vibe Shared!' });
      resetInputs();
    } catch(err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not post comeback.' });
    } finally {
      setIsPosting(false);
    }
  };

  const handleRequestVerdict = async () => {
    const realReplies = comebacks?.filter(c => !c.isBot) || [];
    
    // 🚫 PROTECTION: Prevent duplicate verdicts
    const alreadyJudged = comebacks?.some(c => c.isBot);
    if (alreadyJudged) {
      toast({ title: "Verdict already delivered." });
      return;
    }

    if (!firestore || realReplies.length < 3) {
        toast({ variant: 'destructive', title: "More comebacks needed", description: "The AI Referee needs more vibrations to analyze this battle." });
        return;
    }

    setIsRefereeing(true);
    try {
        const result = await getBattleVerdict({
            originalShade: post.content,
            originalCampus: post.authorAcronym || post.authorCampus || '??',
            targetCampus: post.targetCampus || 'National',
            comebacks: realReplies.map(c => c.text)
        });

        const comebackData = {
            text: `${result.verdict} (Burn Level: ${result.burnLevel}/10). Winner: ${result.winner.toUpperCase()}. ${result.refereeAdvice}`,
            authorId: 'liaison-bot',
            authorName: 'AI Referee',
            authorCampus: 'HUB',
            authorColor: '#f59e0b',
            isCounter: false,
            isBot: true,
            createdAt: serverTimestamp()
        };

        await addDocumentNonBlocking(collection(firestore, 'campus_pulse', post.id, 'comebacks'), comebackData);
        toast({ title: "Verdict Delivered! ⚖️" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Referee busy", description: "The AI Referee is currently auditing another battle." });
    } finally {
        setIsRefereeing(false);
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-border space-y-8 animate-in fade-in duration-300 relative">
      {showEmojiPicker && (
        <div className="absolute bottom-24 left-0 z-[100] shadow-2xl bg-card rounded-[2rem] p-2 border animate-in slide-in-from-bottom-4">
           <div className="flex justify-end mb-2"><button onClick={() => setShowEmojiPicker(false)} className="p-1.5 hover:bg-muted rounded-full text-muted-foreground"><X size={16}/></button></div>
           <EmojiPicker onEmojiClick={(d) => setText(prev => prev + d.emoji)} />
        </div>
      )}

      <div className="flex justify-between items-center px-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
            <Zap size={12} className="text-red-500 animate-pulse" /> Live Comebacks
        </h4>
        {comebacks && comebacks.length >= 2 && !comebacks.some(c => c.isBot) && (
            <button 
                onClick={handleRequestVerdict}
                disabled={isRefereeing}
                className="bg-slate-900 text-amber-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
                {isRefereeing ? <Loader2 className="animate-spin" size={12} /> : <Scale size={12} />}
                Consult AI Referee
            </button>
        )}
      </div>

      <div className="max-h-[500px] overflow-y-auto space-y-6 no-scrollbar pr-2 pb-6">
        {isLoading ? (
            <div className="space-y-6"> 
              <Skeleton className="h-24 w-full rounded-[2rem]" /> 
              <Skeleton className="h-24 w-full rounded-[2rem] pl-8" /> 
            </div>
        ) : comebacks?.length === 0 ? (
             <div className="py-16 text-center opacity-30">
                <ShieldAlert className="mx-auto mb-4" size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Battle Ground Silent</p>
             </div>
        ) : (
            comebacks?.map((c: ArenaComeback) => (
              <ComebackItem key={c.id} c={c} onReply={(name) => { setText(p => `@${name} ${p}`); textInputRef.current?.focus(); }} />
            ))
        )}
      </div>

      <form onSubmit={handleReply} className="space-y-4 pt-4">
        {showUrlInput && (
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Paste YouTube or TikTok Link for Proof..." className="w-full p-5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-300 rounded-3xl text-xs font-mono border-2 border-red-100 dark:border-red-900 focus:border-red-500" />
        )}
        
        {previewUrl && (
            <div className="relative w-48 h-32 rounded-[2rem] overflow-hidden border-4 border-card shadow-2xl group animate-in zoom-in duration-300">
                {file?.type.startsWith('image') ? <Image src={previewUrl} layout="fill" className="object-cover" alt="" /> : <video src={previewUrl} className="w-full h-full object-cover" />}
                <button type="button" onClick={resetInputs} className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-black transition-colors shadow-lg"><X size={14} /></button>
            </div>
        )}

        {isPosting && uploadProgress > 0 && (
            <div className="px-4 space-y-1">
                <div className="flex justify-between text-[8px] font-black uppercase text-blue-500 tracking-widest">
                    <span>Syncing Artillery...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
            </div>
        )}

        <div className="flex items-center gap-2 bg-muted p-2 rounded-[2.5rem] border-2 border-transparent focus-within:border-primary/20 focus-within:bg-background transition-all shadow-inner">
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3.5 text-muted-foreground hover:text-amber-500 rounded-full transition-colors"><Smile size={24}/></button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3.5 text-muted-foreground hover:text-blue-500 rounded-full transition-colors"><ImagePlus size={24}/></button>
          <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="p-3.5 text-muted-foreground hover:text-red-500 rounded-full transition-colors"><Youtube size={24}/></button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
          <input ref={textInputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Drop your battle response..." className="flex-1 bg-transparent border-none outline-none text-sm font-black text-foreground placeholder:text-muted-foreground/60" disabled={isPosting} />
          <button type="submit" disabled={isPosting || (!text.trim() && !videoUrl.trim() && !file)} className="p-5 bg-slate-900 text-white rounded-full active:scale-90 transition-transform shadow-xl disabled:opacity-30">
            {isPosting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
          </button>
        </div>
      </form>
    </div>
  );
}
