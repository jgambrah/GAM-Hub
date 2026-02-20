
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Send, Smile, Reply, Forward, X, ShieldCheck, Paperclip, Loader2, ImagePlus } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import type { Message, User, Group } from '@/lib/types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { ForwardMessageModal } from '../social/ForwardMessageModal';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export default function GroupChat({ group }: { group: Group }) {
  const { firestore, storage, auth } = useFirebase();
  const { user: userProfile } = useAuth();
  const { toast } = useToast();
  
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'groups', group.id, 'messages'), orderBy('createdAt', 'asc')) : null
  , [firestore, group.id]);
  
  const { data: messages, isLoading } = useCollection<Message>(messagesQuery);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !firestore || !auth.currentUser || !userProfile) return;

    const messageData: Partial<Message> = {
      text,
      senderId: auth.currentUser.uid,
      senderName: userProfile.name || "Unknown User",
      createdAt: new Date().toISOString(),
      type: 'text',
      replyTo: replyingTo ? { messageId: replyingTo.id, text: replyingTo.text || '', senderName: replyingTo.senderName } : null,
      isForwarded: false,
    };

    addDocumentNonBlocking(collection(firestore, 'groups', group.id, 'messages'), messageData);
    setText('');
    setReplyingTo(null);
    setShowEmoji(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !storage || !userProfile) return;

    setIsPosting(true);
    try {
        const filePath = `group_media/${group.id}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);

        const messageData: Partial<Message> = {
            senderId: userProfile.id,
            senderName: userProfile.name || "User",
            createdAt: new Date().toISOString(),
            type: file.type.startsWith('image') ? 'image' : 'file',
            mediaUrl: downloadUrl,
            text: file.name,
            isForwarded: false,
        };

        addDocumentNonBlocking(collection(firestore, 'groups', group.id, 'messages'), messageData);
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Upload Failed' });
    } finally {
        setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-slate-900/50 rounded-[3rem] shadow-xl border border-border overflow-hidden">
      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div>
        ) : messages && messages.length > 0 ? (
            messages.map((msg: Message) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                        {!isMe && (
                            <Avatar className="h-8 w-8 mt-auto">
                                <AvatarFallback className="text-[10px] font-black">{msg.senderName.charAt(0)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={`max-w-[75%] group relative p-4 text-sm font-medium leading-relaxed ${isMe ? 'bg-primary text-primary-foreground rounded-3xl rounded-tr-none' : 'bg-muted/50 dark:bg-slate-800 text-foreground rounded-3xl rounded-tl-none border shadow-sm'}`}>
                            
                            {!isMe && <p className="text-[10px] font-black text-primary uppercase mb-1">{msg.senderName}</p>}

                            {msg.isForwarded && (
                                <div className="flex items-center gap-1 text-[10px] opacity-70 mb-2">
                                    <Forward size={12} />
                                    <span className="font-bold">Forwarded</span>
                                </div>
                            )}
                            
                            {msg.replyTo && (
                                <div className="mb-2 p-2 bg-black/10 rounded-xl border-l-4 border-white/50 text-[10px]">
                                    <p className="font-black opacity-70">{msg.replyTo.senderName}</p>
                                    <p className="truncate">{msg.replyTo.text}</p>
                                </div>
                            )}

                            {msg.type === 'image' && msg.mediaUrl ? (
                                <img src={msg.mediaUrl} className="rounded-xl mb-2 max-h-60 object-cover w-full" alt="Shared" />
                            ) : msg.type === 'file' ? (
                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-black/5 rounded-lg mb-2">
                                    <Paperclip size={14} />
                                    <span className="text-xs truncate">{msg.text}</span>
                                </a>
                            ) : (
                                <p>{msg.text}</p>
                            )}

                            <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}>
                                <button onClick={() => setReplyingTo(msg)} className="p-2 bg-background border shadow-sm rounded-full text-muted-foreground hover:text-primary"><Reply size={14}/></button>
                                <button onClick={() => setForwardingMessage(msg)} className="p-2 bg-background border shadow-sm rounded-full text-muted-foreground hover:text-green-600"><Forward size={14}/></button>
                            </div>
                        </div>
                    </div>
                )
            })
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
                <ShieldCheck size={64} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Yard Fortress Encrypted</p>
                <p className="text-[10px] mt-2 italic font-medium">Start the vibration by sending a message.</p>
            </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-background border-t border-border relative flex-shrink-0">
        {showEmoji && (
          <div className="absolute bottom-full mb-4 left-4 z-50 shadow-2xl animate-in slide-in-from-bottom-2">
              <div className="flex justify-end p-2 bg-background rounded-t-2xl border-b border-border">
                  <button onClick={() => setShowEmoji(false)} className="p-1 hover:bg-muted rounded-full">
                      <X size={16} className="text-muted-foreground" />
                  </button>
              </div>
            <EmojiPicker onEmojiClick={(d) => setText(prev => prev + d.emoji)} />
          </div>
        )}

        {replyingTo && (
          <div className="mb-3 p-3 bg-primary/5 rounded-2xl flex justify-between items-center animate-in slide-in-from-bottom-2 border border-primary/10">
            <div className="border-l-4 border-primary pl-3">
               <p className="text-[10px] font-black text-primary uppercase">Replying to {replyingTo.senderName}</p>
               <p className="text-xs text-muted-foreground truncate">{replyingTo.text}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 bg-primary/10 text-primary rounded-full"><X size={14}/></button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="relative flex-1 group">
            <input 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Post to the Yard..."
              className="w-full bg-muted/50 p-4 pl-24 rounded-[2rem] border-none outline-none text-sm font-medium focus:bg-background focus:ring-2 focus:ring-primary transition-all"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                <Smile size={22} />
              </button>
               <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
               >
                {isUploading ? <Loader2 className="animate-spin" size={20}/> : <ImagePlus size={22} />}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            </div>
          </div>
          <button type="submit" disabled={!text.trim()} className="p-4 bg-slate-900 text-white dark:bg-primary dark:text-white rounded-full shadow-lg active:scale-90 transition-transform disabled:opacity-30 disabled:scale-100">
            <Send size={20} />
          </button>
        </form>
      </div>
      
      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage}
          isOpen={!!forwardingMessage}
          onClose={() => setForwardingMessage(null)}
        />
      )}
    </div>
  );
}
