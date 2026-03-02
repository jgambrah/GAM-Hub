'use client';

import React, { useState } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, orderBy, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Send, Loader2, Smile, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

export default function CommentSection({ postId }: { postId: string }) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { firestore } = useFirebase();
  const { user: userProfile } = useAuth();
  const { toast } = useToast();
  const [isPosting, setIsPosting] = useState(false);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // UNIFIED PATH: Targets campus_pulse hierarchy
    return query(collection(firestore, 'campus_pulse', postId, 'comments'), orderBy('createdAt', 'asc'));
  }, [firestore, postId]);
  
  const { data: comments, isLoading } = useCollection<any>(commentsQuery);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !firestore || !userProfile) return;
    setIsPosting(true);

    try {
        await addDoc(collection(firestore, 'campus_pulse', postId, 'comments'), {
            text: text.trim(),
            userId: userProfile.id,
            userName: userProfile.name || "Member",
            userAvatarUrl: userProfile.avatarUrl ?? "",
            createdAt: serverTimestamp(),
        });

        await updateDoc(doc(firestore, 'campus_pulse', postId), {
            commentCount: increment(1)
        });

        setText('');
        setShowEmojiPicker(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not post comment." });
    } finally {
        setIsPosting(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-border relative">
      {/* COMMENTS LIST */}
      <div className="space-y-3 max-h-48 overflow-y-auto mb-4 no-scrollbar">
        {isLoading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
        ) : comments?.length === 0 ? (
            <p className="text-[10px] text-center text-muted-foreground font-black uppercase tracking-widest py-4 opacity-50">Be the first to comment</p>
        ) : (
            comments?.map((c: any) => (
                <div key={c.id} className="flex gap-2 items-start animate-in fade-in">
                    <Avatar className="w-8 h-8">
                        <AvatarImage src={c.userAvatarUrl} />
                        <AvatarFallback>{c.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted p-3 rounded-2xl flex-1">
                       <p className="text-[10px] font-black text-foreground">{c.userName}</p>
                       <p className="text-xs text-muted-foreground mt-1">{c.text}</p>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* EMOJI PICKER OVERLAY */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-0 z-[100] shadow-2xl bg-card rounded-3xl p-2 border animate-in slide-in-from-bottom-4 duration-300">
           <div className="flex justify-end mb-2">
             <button onClick={() => setShowEmojiPicker(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground">
               <X size={16}/>
             </button>
           </div>
           <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}

      {/* COMMENT FORM */}
      <form onSubmit={postComment} className="flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-transparent focus-within:bg-background focus-within:border-border transition-all shadow-inner">
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
          placeholder="Drop a comment..." 
          className="flex-1 bg-transparent border-none outline-none text-sm font-medium px-2 text-foreground"
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
