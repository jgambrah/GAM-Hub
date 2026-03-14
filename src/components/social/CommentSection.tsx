
'use client';

import React, { useState } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, orderBy, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Send, Loader2, Smile, X, Bold, Italic, Mic } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { cn } from '@/lib/utils';
import { recordEngagement } from '@/lib/trending-service';
import { uploadAudio } from '@/lib/audio-service';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';

export default function CommentSection({ postId, authorId }: { postId: string, authorId?: string }) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isExtraBold, setIsExtraBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const { firestore, storage } = useFirebase();
  const { user: userProfile } = useAuth();
  const { toast } = useToast();
  const [isPosting, setIsPosting] = useState(false);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'campus_pulse', postId, 'comments'), orderBy('createdAt', 'asc'));
  }, [firestore, postId]);
  
  const { data: comments, isLoading } = useCollection<any>(commentsQuery);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handlePostComment = async (payload: any) => {
    if (!firestore || !userProfile) return;
    setIsPosting(true);

    try {
        const styleString = `${isExtraBold ? 'extrabold ' : ''}${isItalic ? 'italic' : ''}`.trim() || 'bold';

        await addDoc(collection(firestore, 'campus_pulse', postId, 'comments'), {
            ...payload,
            style: styleString,
            userId: userProfile.id,
            userName: userProfile.name || "Member",
            userAvatarUrl: userProfile.avatarUrl ?? "",
            createdAt: serverTimestamp(),
        });

        await updateDoc(doc(firestore, 'campus_pulse', postId), {
            commentCount: increment(1)
        });

        recordEngagement(firestore, postId, 'comment', authorId);

        setText('');
        setShowEmojiPicker(false);
        setIsExtraBold(false);
        setIsItalic(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not post comment." });
    } finally {
        setIsPosting(false);
    }
  };

  const handlePostText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    handlePostComment({ text: text.trim(), type: 'text' });
  };

  const handleSendAudioComment = async (blob: Blob, duration: number) => {
    if (!storage || !firestore || !userProfile) return;
    
    setIsUploading(true);
    try {
      const filePath = `voice_comments/${postId}/${Date.now()}_voice.webm`;
      const audioUrl = await uploadAudio(storage, blob, filePath);

      await handlePostComment({ 
        type: 'audio', 
        mediaUrl: audioUrl,
        duration: duration,
        text: "🎤 Voice Comment" 
      });

    } catch (err) {
      console.error("Liaison Voice Comment Error:", err);
      toast({ variant: 'destructive', title: "Voice Comment Failed" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-border relative">
      <div className="space-y-4 max-h-80 overflow-y-auto mb-6 no-scrollbar pr-1">
        {isLoading ? (
            <div className="space-y-3"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>
        ) : comments?.length === 0 ? (
            <p className="text-[10px] text-center text-muted-foreground font-black uppercase tracking-widest py-8 opacity-40 italic">Be the first to speak your thoughts...</p>
        ) : (
            comments?.map((c: any) => (
                <div key={c.id} className="flex gap-3 items-start animate-in fade-in">
                    <Avatar className="w-9 h-9 flex-shrink-0 border shadow-sm">
                        <AvatarImage src={c.userAvatarUrl} />
                        <AvatarFallback className="font-black">{c.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted p-3.5 rounded-[1.5rem] flex-1 min-w-0 shadow-sm border border-border/50">
                       <p className="text-[10px] font-black text-primary uppercase tracking-tighter mb-1.5">{c.userName}</p>
                       {c.type === 'audio' ? (
                         <div className="mt-1 max-w-full">
                           <VoicePlayer 
                             url={c.mediaUrl} 
                             duration={c.duration} 
                             theme="dark" 
                           />
                         </div>
                       ) : (
                         <p className={cn(
                             "text-sm leading-snug break-words",
                             c.style?.includes('extrabold') ? "font-black" : "font-bold",
                             c.style?.includes('italic') && "italic"
                         )}>
                             {c.text}
                         </p>
                       )}
                    </div>
                </div>
            ))
        )}
      </div>

      {isUploading && (
        <div className="absolute inset-x-0 bottom-0 top-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center gap-2 rounded-2xl">
          <Loader2 className="animate-spin text-primary" size={20} />
          <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Syncing Voice Vibe...</span>
        </div>
      )}

      {showEmojiPicker && (
        <div className="absolute bottom-32 left-0 z-[100] shadow-2xl bg-card rounded-3xl p-2 border animate-in slide-in-from-bottom-4 duration-300">
           <div className="flex justify-end mb-2">
             <button onClick={() => setShowEmojiPicker(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground">
               <X size={16}/>
             </button>
           </div>
           <EmojiPicker onEmojiClick={(d) => setText(prev => prev + d.emoji)} />
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 px-2">
          <button 
            type="button"
            onClick={() => setIsExtraBold(!isExtraBold)}
            className={cn(
                "p-2.5 rounded-xl transition-all shadow-sm border-2",
                isExtraBold ? "bg-slate-900 text-white border-slate-900" : "bg-white text-muted-foreground border-transparent hover:border-slate-200"
            )}
            title="Extra Bold"
          >
            <Bold size={16} />
          </button>
          <button 
            type="button"
            onClick={() => setIsItalic(!isItalic)}
            className={cn(
                "p-2.5 rounded-xl transition-all shadow-sm border-2",
                isItalic ? "bg-slate-900 text-white border-slate-900" : "bg-white text-muted-foreground border-transparent hover:border-slate-200"
            )}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <div className="h-6 w-[1px] bg-border mx-2" />
          <VoiceRecorder onSend={handleSendAudioComment} disabled={isPosting} />
      </div>

      <form onSubmit={handlePostText} className="flex items-center gap-2 bg-muted p-2 rounded-[2.5rem] border-2 border-transparent focus-within:bg-background focus-within:border-primary/20 transition-all shadow-inner">
        <button 
          type="button" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-3 text-muted-foreground hover:text-amber-500 rounded-full transition-colors"
        >
          <Smile size={22} />
        </button>
        <input 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Speak your mind or drop a bold thought..." 
          className={cn(
              "flex-1 bg-transparent border-none outline-none text-sm px-2 text-foreground transition-all placeholder:text-muted-foreground/60 placeholder:font-bold",
              isExtraBold ? "font-black" : "font-bold",
              isItalic && "italic"
          )}
          disabled={isPosting}
        />
        <button 
          type="submit" 
          disabled={!text.trim() || isPosting} 
          className="p-4 bg-slate-900 text-white dark:bg-primary dark:text-white rounded-full transition-all active:scale-90 disabled:opacity-30 shadow-lg"
        >
          {isPosting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
}
