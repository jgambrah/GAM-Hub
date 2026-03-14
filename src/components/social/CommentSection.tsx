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

  const handleSendAudioComment = async (blob: Blob) => {
    if (!storage || !firestore || !userProfile) return;
    
    setIsUploading(true);
    try {
      const filePath = `voice_comments/${postId}/${Date.now()}_voice.webm`;
      const audioUrl = await uploadAudio(storage, blob, filePath);

      await handlePostComment({ 
        type: 'audio', 
        mediaUrl: audioUrl,
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
      <div className="space-y-3 max-h-60 overflow-y-auto mb-4 no-scrollbar">
        {isLoading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
        ) : comments?.length === 0 ? (
            <p className="text-[10px] text-center text-muted-foreground font-black uppercase tracking-widest py-4 opacity-50">Be the first to comment</p>
        ) : (
            comments?.map((c: any) => (
                <div key={c.id} className="flex gap-2 items-start animate-in fade-in">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={c.userAvatarUrl} />
                        <AvatarFallback>{c.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted p-3 rounded-2xl flex-1 min-w-0">
                       <p className="text-[10px] font-black text-foreground">{c.userName}</p>
                       {c.type === 'audio' ? (
                         <div className="mt-1">
                           <audio src={c.mediaUrl} controls className="h-8 w-full max-w-[180px]" />
                         </div>
                       ) : (
                         <p className={cn(
                             "text-xs mt-1 leading-snug break-words",
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
        <div className="absolute inset-x-0 bottom-0 top-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center gap-2 rounded-xl">
          <Loader2 className="animate-spin text-primary" size={16} />
          <span className="text-[10px] font-black uppercase text-primary">Sending Voice Vibe...</span>
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

      <div className="flex items-center gap-2 mb-2 px-2">
          <button 
            type="button"
            onClick={() => setIsExtraBold(!isExtraBold)}
            className={cn(
                "p-2 rounded-lg transition-all",
                isExtraBold ? "bg-slate-900 text-white shadow-md" : "text-muted-foreground hover:bg-muted"
            )}
            title="Extra Bold"
          >
            <Bold size={16} />
          </button>
          <button 
            type="button"
            onClick={() => setIsItalic(!isItalic)}
            className={cn(
                "p-2 rounded-lg transition-all",
                isItalic ? "bg-slate-900 text-white shadow-md" : "text-muted-foreground hover:bg-muted"
            )}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <div className="h-4 w-[1px] bg-border mx-1" />
          <VoiceRecorder onSend={handleSendAudioComment} disabled={isPosting} />
      </div>

      <form onSubmit={handlePostText} className="flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-transparent focus-within:bg-background focus-within:border-border transition-all shadow-inner">
        <button 
          type="button" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2.5 text-muted-foreground hover:text-amber-500 rounded-full transition-colors"
        >
          <Smile size={20} />
        </button>
        <input 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Drop a bold comment..." 
          className={cn(
              "flex-1 bg-transparent border-none outline-none text-sm px-2 text-foreground transition-all",
              isExtraBold ? "font-black" : "font-bold",
              isItalic && "italic"
          )}
          disabled={isPosting}
        />
        <button 
          type="submit" 
          disabled={!text.trim() || isPosting} 
          className="p-3 bg-slate-900 text-white dark:bg-primary dark:text-white rounded-full transition-all active:scale-90 disabled:opacity-30 shadow-lg"
        >
          {isPosting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
