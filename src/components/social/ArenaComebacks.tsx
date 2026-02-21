'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { ArenaPost, ArenaComeback } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { campuses } from '@/lib/data';
import { Send, Zap, Loader2, Smile, ImagePlus, Video, X, Play, Youtube, Bot, ShieldAlert } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import Image from 'next/image';
import { TikTokEmbed } from './tiktok-embed';
import { cn } from '@/lib/utils';

const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
        const videoId = match[2];
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`;
    }
    return '';
}

/**
 * ComebackItem Component
 * Renders an individual comeback or bot verdict with stabilized media logic.
 */
function ComebackItem({ c, onReply }: { c: ArenaComeback, onReply: (name: string) => void }) {
    const stabilizedEmbedUrl = useMemo(() => {
        if (c.mediaType === 'youtube' && c.mediaUrl) {
            return getYouTubeEmbedUrl(c.mediaUrl);
        }
        if (c.mediaType === 'tiktok' && c.mediaUrl) {
            return c.mediaUrl;
        }
        return '';
    }, [c.mediaUrl, c.mediaType]);

    const isReply = !c.isBot && c.text && c.text.startsWith('@');

    if (c.isBot) {
        return (
            <div className="flex flex-col items-center my-6 animate-in zoom-in duration-500">
                <div className="bg-slate-900 text-amber-400 p-6 rounded-[2rem] border-2 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.2)] max-w-[95%] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5"><ShieldAlert size={60}/></div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950 shadow-lg">
                            <Bot size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Official Liaison Verdict</span>
                    </div>
                    <p className="text-sm font-bold italic leading-relaxed">
                        "🤖 {c.text}"
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full group/comeback animate-in fade-in slide-in-from-bottom-2", isReply && "pl-8")}>
            <div className="flex items-center gap-2 mb-1.5 px-2">
                <span className="text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase shadow-sm" style={{ backgroundColor: c.authorColor }}>
                    {c.authorCampus}
                </span>
                {c.isCounter && (
                    <span className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1">
                        <Zap size={10} fill="currentColor" /> Counter-Shade
                    </span>
                )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm group-hover/comeback:shadow-md transition-all">
                {/* INLINE MULTIMEDIA EVIDENCE */}
                {c.mediaUrl && (
                    <div className="mb-3 rounded-xl overflow-hidden bg-black border border-border shadow-inner">
                        {c.mediaType === 'image' && (
                            <Image src={c.mediaUrl} width={400} height={300} className="w-full h-auto object-cover max-h-60" alt="evidence" />
                        )}
                        {c.mediaType === 'video' && (
                            <video src={c.mediaUrl} controls className="w-full max-h-60" />
                        )}
                        {c.mediaType === 'youtube' && stabilizedEmbedUrl && (
                            <iframe src={stabilizedEmbedUrl} className="w-full aspect-video h-auto" allow="autoplay; encrypted-media" allowFullScreen />
                        )}
                        {c.mediaType === 'tiktok' && stabilizedEmbedUrl && (
                            <div className="bg-black flex justify-center py-2">
                                <TikTokEmbed url={stabilizedEmbedUrl} />
                            </div>
                        )}
                    </div>
                )}

                {c.text && (
                    <p className={cn(
                        "text-sm text-slate-900 dark:text-slate-100 font-black leading-snug",
                        isReply && "text-slate-600 dark:text-slate-400 font-bold"
                    )}>
                        {c.text}
                    </p>
                )}
            </div>

            <div className="flex justify-end pt-1 pr-4">
                <button 
                    onClick={() => onReply(c.authorName)} 
                    className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest opacity-0 group-hover/comeback:opacity-100 transition-opacity"
                >
                    Reply
                </button>
            </div>
        </div>
    );
}

export default function ArenaComebacks({ post }: { post: ArenaPost }) {
  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
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
    return query(collection(firestore, 'arena_posts', post.id, 'comebacks'), orderBy('createdAt', 'asc'));
  }, [firestore, post.id]);

  const { data: comebacks, isLoading } = useCollection<ArenaComeback>(comebacksQuery);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prevInput) => prevInput + emojiData.emoji);
    setShowEmojiPicker(false); // Automatically close after selection
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };
  
  const resetInputs = () => {
    setText('');
    setVideoUrl('');
    setShowUrlInput(false);
    setShowEmojiPicker(false);
    setFile(null);
    setPreviewUrl(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !videoUrl.trim() && !file) || !firestore || !storage || !userProfile) return;
    setIsPosting(true);

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
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);

        comebackData.mediaUrl = downloadUrl;
        comebackData.mediaType = file.type.startsWith('image') ? 'image' : 'video';
      } else if (videoUrl.trim()) {
        comebackData.mediaUrl = videoUrl.trim();
        comebackData.mediaType = videoUrl.includes('youtube') || videoUrl.includes('youtu.be') ? 'youtube' : 'tiktok';
      }
      
      await addDocumentNonBlocking(collection(firestore, 'arena_posts', post.id, 'comebacks'), comebackData);

      const postRef = doc(firestore, 'arena_posts', post.id);
      await updateDocumentNonBlocking(postRef, {
        comebackCount: increment(1)
      });
      
      resetInputs();
    } catch(err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not post comeback.' });
    } finally {
      setIsPosting(false);
    }
  };

  const handleSetReply = (authorName: string) => {
      if(!authorName) return;
      setText(prev => `@${authorName} ${prev}`);
      textInputRef.current?.focus();
  }

  return (
    <div className="mt-6 pt-6 border-t border-border space-y-6 animate-in fade-in duration-300 relative">
      {/* EMOJI PICKER OVERLAY */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-0 z-[100] shadow-2xl bg-card rounded-3xl p-2 border animate-in slide-in-from-bottom-4 duration-300">
           <div className="flex justify-end mb-2">
             <button onClick={() => setShowEmojiPicker(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors">
               <X size={16}/>
             </button>
           </div>
           <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}

      {/* COMMEBACKS LIST */}
      <div className="max-h-[400px] overflow-y-auto space-y-4 no-scrollbar pr-2 pb-4">
        {isLoading ? (
            <div className="space-y-4"> 
              <Skeleton className="h-20 w-full rounded-2xl" /> 
              <Skeleton className="h-20 w-full rounded-2xl pl-8" /> 
            </div>
        ) : comebacks?.length === 0 ? (
             <p className="text-[10px] text-muted-foreground text-center py-10 font-black uppercase tracking-[0.3em] opacity-50">No comebacks yet. Break the silence.</p>
        ) : (
            comebacks?.map((c: ArenaComeback) => (
              <ComebackItem key={c.id} c={c} onReply={handleSetReply} />
            ))
        )}
      </div>

      {/* INPUT COMMAND CENTER */}
      <form onSubmit={handleReply} className="space-y-3">
        {showUrlInput && (
          <input 
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube or TikTok Link for Evidence..."
            className="w-full p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-2xl text-xs font-mono border-2 border-red-100 dark:border-red-900 outline-none focus:border-red-500 transition-all"
          />
        )}
        
        {previewUrl && (
            <div className="relative w-40 h-24 rounded-2xl overflow-hidden border-4 border-card shadow-lg animate-in zoom-in duration-300">
                {file?.type.startsWith('image') ?
                    <Image src={previewUrl} layout="fill" className="object-cover" alt="preview" /> :
                    <video src={previewUrl} className="w-full h-full object-cover" />
                }
                <button type="button" onClick={resetInputs} className="absolute top-1.5 right-1.5 bg-black/60 text-white p-1.5 rounded-full hover:bg-black transition-colors shadow-lg">
                  <X size={12} />
                </button>
            </div>
        )}

        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-[2.5rem] border-2 border-transparent focus-within:border-primary/20 focus-within:bg-background transition-all shadow-inner">
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 text-muted-foreground hover:text-amber-500 rounded-full transition-colors">
            <Smile size={20}/>
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-muted-foreground hover:text-blue-500 rounded-full transition-colors">
            <ImagePlus size={20}/>
          </button>
          <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="p-3 text-muted-foreground hover:text-red-500 rounded-full transition-colors">
            <Youtube size={20}/>
          </button>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
          
          <input 
            ref={textInputRef}
            value={text} 
            onChange={(e) => setText(e.target.value)}
            placeholder="Add your intellectual comeback..." 
            className="flex-1 bg-transparent border-none outline-none text-sm font-black text-foreground placeholder:text-muted-foreground placeholder:font-bold"
            disabled={isPosting}
          />
          
          <button 
            type="submit"
            disabled={isPosting || (!text.trim() && !videoUrl.trim() && !file)} 
            className="p-4 bg-foreground text-background rounded-full active:scale-90 transition-transform disabled:opacity-30 disabled:scale-100 shadow-lg"
          >
            {isPosting ? <Loader2 className="animate-spin" size={18}/> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
