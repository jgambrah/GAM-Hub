'use client';

import React, { useState } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, orderBy, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Send, Loader2, Smile, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';


type Comment = {
    id: string;
    text: string;
    userId: string;
    userName: string;
    userAvatarUrl: string;
    createdAt: any;
}

export default function CommentSection({ postId }: { postId: string }) {
  const [text, setText] = useState('');
  const { firestore } = useFirebase();
  const { user: userProfile } = useAuth();
  const { toast } = useToast();
  const [isPosting, setIsPosting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'social_posts', postId, 'comments'), orderBy('createdAt', 'asc'));
  }, [firestore, postId]);
  
  const { data: comments, isLoading } = useCollection<Comment>(commentsQuery);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !firestore || !userProfile) return;
    
    setIsPosting(true);

    try {
        const commentsRef = collection(firestore, 'social_posts', postId, 'comments');
        await addDoc(commentsRef, {
            text: text.trim(),
            userId: userProfile.id,
            userName: userProfile.name || "Campus Member",
            userAvatarUrl: userProfile.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name || 'default'}`,
            createdAt: serverTimestamp(),
        });

        const postRef = doc(firestore, 'social_posts', postId);
        await updateDoc(postRef, {
            commentCount: increment(1)
        });

        setText('');
        setShowEmojiPicker(false);
    } catch (error) {
        console.error("Failed to post comment:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not post your comment."
        });
    } finally {
        setIsPosting(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-border relative">
      
      {/* EMOJI PICKER POPOVER */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-0 z-[100] shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
           <div className="flex justify-end p-2 bg-background rounded-t-2xl border border-b-0 border-border">
              <button onClick={() => setShowEmojiPicker(false)} className="p-1 hover:bg-muted rounded-full">
                <X size={16} className="text-muted-foreground" />
              </button>
           </div>
           <EmojiPicker 
              onEmojiClick={onEmojiClick} 
              theme={Theme.LIGHT} // TODO: Could connect this to the app's theme
              width={300}
              height={400}
              skinTonesDisabled
              searchDisabled={false}
           />
        </div>
      )}

      {/* List Comments */}
      <div className="space-y-3 max-h-48 overflow-y-auto px-1 mb-4">
        {isLoading ? (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        ) : comments && comments.length > 0 ? (
            comments.map((c: Comment) => (
                <div key={c.id} className="flex gap-2 items-start">
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
        ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Be the first to comment!</p>
        )}
      </div>

      {/* INPUT AREA */}
      {userProfile && (
        <form onSubmit={postComment} className="flex items-center gap-3 bg-muted p-2 rounded-[2rem] border border-border focus-within:border-primary focus-within:bg-background transition-all">
          <button 
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-3 rounded-full transition-colors ${showEmojiPicker ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            <Smile size={22} />
          </button>

          <input 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Drop a comment... 🚀🔥" 
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-foreground"
            disabled={isPosting}
          />

          <Button 
            type="submit"
            disabled={!text.trim() || isPosting}
            className="p-3 h-auto w-auto bg-foreground text-background rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-muted disabled:opacity-30 disabled:scale-100"
          >
            {isPosting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </Button>
        </form>
      )}
    </div>
  );
}
