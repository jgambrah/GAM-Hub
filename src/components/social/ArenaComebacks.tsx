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
    setShowEmojiPicker(false);
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
    <div className="mt-6 pt-6 border-t border-border space-y-4 animate-in fade-in duration-300 relative">
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-0 z-[100] shadow-2xl bg-card rounded-3xl p-2 border">
           <div className="flex justify-end mb-2"><button onClick={() => setShowEmojiPicker(false)} className="p-1 hover:bg-muted rounded-full"><X size={16}/></button></div>
           <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}
      <div className="max-h-60 overflow-y-auto space-y-3 no-scrollbar pr-2">
        {isLoading ? (
            <div className="space-y-2"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> </div>
        ) : comebacks?.length === 0 ? (
             <p className="text-xs text-muted-foreground text-center py-4">No comebacks yet. Be the first!</p>
        ) : (
            comebacks?.map((c: ArenaComeback) => {
              const isReply = !c.isBot && c.text && c.text.startsWith('@');
              
              // LIAISON STABILIZATION: Lock embed URL to prevent flickering during list updates
              const stabilizedEmbedUrl = useMemo(() => {
                if (c.mediaType === 'youtube' && c.mediaUrl) {
                    return getYouTubeEmbedUrl(c.mediaUrl);
                }
                if (c.mediaType === 'tiktok' && c.mediaUrl) {
                    return c.mediaUrl;
                }
                return '';
              }, [c.mediaUrl, c.mediaType]);

              return (
              <div key={c.id} className={`flex flex-col gap-1 ${c.isBot ? 'items-center my-4' : ''}`}>
                {c.isBot ? (
                  <div className="bg-slate-900 text-white p-4 rounded-3xl border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] max-w-[90%] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><ShieldAlert size={40}/></div>
                    <div className="flex items-center gap-2 mb-2">
                       <div className="p-1 bg-amber-500 rounded-lg text-slate-900"><Bot size={14} /></div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Official Liaison Verdict</span>
                    </div>
                    <p className="text-sm font-medium italic">"{c.text}"</p>
                  </div>
                ) : (
                  <div className={`w-full group/comeback ${isReply ? 'pl-6' : ''}`}>
                    <div className={`flex items-center gap-2 mb-1`}>
                      <span className="text-[8px] font-black text-white px-2 py-0.5 rounded uppercase" style={{ backgroundColor: c.authorColor }}>{c.authorCampus}</span>
                      {c.isCounter && <span className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1"><Zap size={8} fill="currentColor"/> Counter-Shade</span>}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        {c.mediaType === 'image' && c.mediaUrl && <Image src={c.mediaUrl} width={200} height={200} className="rounded-lg object-cover" alt="comeback image" />}
                        {c.mediaType === 'video' && c.mediaUrl && <video src={c.mediaUrl} controls className="w-full rounded-lg" />}
                        {c.mediaType === 'youtube' && stabilizedEmbedUrl && (
                            <iframe src={stabilizedEmbedUrl} className="w-full h-auto aspect-video rounded-lg" allow="autoplay; encrypted-media" allowFullScreen />
                        )}
                        {c.mediaType === 'tiktok' && stabilizedEmbedUrl && <div className="bg-black rounded-lg"><TikTokEmbed url={stabilizedEmbedUrl} /></div>}
                        {c.text && <p className={`text-sm text-foreground mt-1 ${isReply ? 'font-semibold' : 'font-bold'}`}>{c.text}</p>}
                    </div>
                    <div className="flex justify-end pt-1">
                        <button onClick={() => handleSetReply(c.authorName)} className="text-[10px] font-bold text-muted-foreground hover:text-primary opacity-0 group-hover/comeback:opacity-100 transition-opacity">
                            Reply
                        </button>
                    </div>
                  </div>
                )}
              </div>
            )})
        )}
      </div>

      <form onSubmit={handleReply} className="space-y-3">
        {showUrlInput && (
          <input 
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube or TikTok Link for evidence..."
            className="w-full p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl text-xs font-mono border border-red-100 dark:border-red-900"
          />
        )}
        {previewUrl && (
            <div className="relative w-32 h-20 rounded-lg overflow-hidden border-2 border-border">
                {file?.type.startsWith('image') ?
                    <Image src={previewUrl} layout="fill" className="object-cover" alt="preview" /> :
                    <video src={previewUrl} className="w-full h-full object-cover" />
                }
                <button type="button" onClick={resetInputs} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><X size={12} /></button>
            </div>
        )}
        <div className="flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-border focus-within:bg-background transition-all">
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2.5 text-muted-foreground hover:text-amber-500 rounded-full transition-colors"><Smile size={18}/></button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-muted-foreground hover:text-blue-500 rounded-full transition-colors"><ImagePlus size={18}/></button>
          <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="p-2.5 text-muted-foreground hover:text-red-500 rounded-full transition-colors"><Youtube size={18}/></button>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
          
          <input 
            ref={textInputRef}
            value={text} 
            onChange={(e) => setText(e.target.value)}
            placeholder="Add your intellectual comeback..." 
            className="flex-1 bg-transparent border-none outline-none text-sm"
            disabled={isPosting}
          />
          
          <button disabled={isPosting || (!text.trim() && !videoUrl.trim() && !file)} className="p-3 bg-foreground text-background rounded-full active:scale-95 transition-all disabled:opacity-50">
            {isPosting ? <Loader2 className="animate-spin" size={16}/> : <Send size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
